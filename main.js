/**
 * Implements the command-line based game interface
 *
 * @flow
 */
import readline from 'readline-promise';
import {Connection} from '@solana/web3.js';

import {url} from './url';
import {sleep} from './sleep';
import {TicTacToe} from './tic-tac-toe';
import {TicTacToeDashboard} from './tic-tac-toe-dashboard';
import {createNewAccount} from './create-new-account';
import type {TicTacToeBoard} from './tic-tac-toe';

function renderBoard(board: TicTacToeBoard): string {
  return [
    board.slice(0,3).join('|'),
    '-+-+-',
    board.slice(3,6).join('|'),
    '-+-+-',
    board.slice(6,9).join('|'),
  ].join('\n');
}

async function startGame(
  connection: Connection,
  dashboard: TicTacToeDashboard
): Promise<TicTacToe> {

  const myAccount = await createNewAccount(connection);
  const myGame = await TicTacToe.create(connection, myAccount);

  // Look for pending games from others, while trying to advertise our game.
  for (;;) {
    await Promise.all([myGame.updateGameState(), dashboard.update()]);

    if (myGame.state.inProgress) {
      // Another player joined our game
      console.log(`Another player accepted our game (${myGame.gamePublicKey})`);
      break;
    }

    const pendingGamePublicKey = dashboard.state.pending;
    if (pendingGamePublicKey !== myGame.gamePublicKey) {
      try {
        console.log(`Trying to join ${pendingGamePublicKey}`);
        const theirGame = await TicTacToe.join(
          connection,
          myAccount,
          dashboard.state.pending
        );
        if (theirGame.state.inProgress) {
          if (theirGame.state.playerO === myAccount.publicKey) {
            console.log(`Joined game ${pendingGamePublicKey}`);
            myGame.abandonGame();
            return theirGame;
          }
        }
      } catch (err) {
        console.log(err.message);
      }

      // Advertise myGame as the pending game for others to see and hopefully
      // join
      console.log(`Advertising our game (${myGame.gamePublicKey})`);
      await dashboard.submitGameState(myGame.gamePublicKey);
    }

    // Wait for a bite
    await sleep(500);
  }
  return myGame;
}

async function main(url: string) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: true
  });

  //
  // Connect to the network with a new account, and airdrop a minimal amount of tokens
  //
  rl.write(`Connecting to network: ${url}...`);
  const connection = new Connection(url);


  // Create/load the game dashboard
  const dashboardPublicKey = 'GriTuZr9NTaSbTcPR38VDDyLkcPt8mTEut8cspgBjjQZ';
  const dashboard = await TicTacToeDashboard.connect(connection, dashboardPublicKey);

  rl.write(`Total games played: ${dashboard.state.total}\n\n`);

  rl.write(`Recently completed games: ${dashboard.state.completed.length}\n`);
  for (const [i, gamePublicKey] of dashboard.state.completed.entries()) {
    const state = await TicTacToe.getGameState(connection, gamePublicKey);
    rl.write(`Game #${i}: ${state.gameState}\n${renderBoard(state.board)}\n\n`);
  }

  // Find opponent
  console.log('Looking for another player');
  const ttt = await startGame(connection, dashboard);

  //
  // Main game loop
  //
  rl.write(`\nThe game has started. You are ${ttt.isX ? 'X' : 'O'}\n`);
  let showBoard = false;
  for (;;) {
    await ttt.updateGameState();
    if (showBoard) {
      rl.write(`\n${renderBoard(ttt.state.board)}\n`);
    }
    showBoard = false;

    if (!ttt.state.inProgress) {
      break;
    }
    if (!ttt.state.myTurn) {
      rl.write('.');
      // For now it's necessary to poll the network for state changes, check
      // twice a second.
      await sleep(500);
      continue;
    }
    rl.write(`\nYour turn.\n${renderBoard(ttt.state.board)}\n`);

    let coords = '?x?';
    for (;;) {
      coords = await rl.questionAsync('Enter row and column (eg. 1x3): ');
      if (/^[123]x[123]$/.test(coords)) {
        break;
      }
      rl.write(`Invalid response: ${coords}\n`);
    }

    await ttt.move(Number(coords[0]) - 1, Number(coords[2]) - 1);
    showBoard = true;
  }


  //
  // Display result
  //
  if (ttt.abandoned) {
    rl.write('\nGame has been abandoned\n');
    return;
  }
  rl.write(`\nGame Over\n=========\n\n${renderBoard(ttt.state.board)}\n\n`);
  if (ttt.state.winner) {
    rl.write('You won!\n');

    // Inform the dashboard of the victory
    await dashboard.submitGameState(ttt.gamePublicKey);
  } else if (ttt.state.draw) {
    rl.write('Draw.\n');
  } else {
    rl.write('You lost.\n');
  }
}

main(url)
.catch((err) => {
  console.error(err);
})
.then(() => process.exit());

