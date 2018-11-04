/**
 * Implements the command-line based game interface
 *
 * @flow
 */
import readline from 'readline-promise';
import {Connection} from '@solana/web3.js';

import {url} from '../../url';
import {sleep} from '../util/sleep';
import {TicTacToe} from '../program/tic-tac-toe';
import type {Board} from '../program/program-state';
import {findDashboard} from '../server/config';

function renderBoard(board: Board): string {
  return [
    board.slice(0, 3).join('|'),
    '-+-+-',
    board.slice(3, 6).join('|'),
    '-+-+-',
    board.slice(6, 9).join('|'),
  ].join('\n');
}

async function main(url: string) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: true,
  });

  //
  // Connect to the network with a new account, and airdrop a minimal amount of tokens
  //
  rl.write(`Connecting to network: ${url}...\n`);
  const connection = new Connection(url);

  // Create/load the game dashboard
  const dashboard = await findDashboard(connection);
  rl.write(`Dashboard: ${dashboard.publicKey.toBase58()}\n`);

  rl.write(`Total games played: ${dashboard.state.totalGames}\n\n`);
  try {
    for (const [i, gamePublicKey] of dashboard.state.completedGames.entries()) {
      const state = await TicTacToe.getGameState(connection, gamePublicKey);
      const lastMove = new Date(Math.max(...state.keepAlive));

      rl.write(`Game #${i}: ${state.gameState}\n`);
      rl.write(`${renderBoard(state.board)}\n`);
      rl.write(
        `${lastMove.getSeconds() === 0 ? '?' : lastMove.toLocaleString()}\n\n`,
      );
    }
  } catch (err) {
    console.log(err);
  }

  // Find opponent
  rl.write('Looking for another player\n');
  const ttt = await dashboard.startGame();

  //
  // Main game loop
  //
  rl.write(`\nThe game has started. You are ${ttt.isX ? 'X' : 'O'}\n`);
  let showBoard = false;

  let gameUpdateCounter = 0;
  ttt.onChange(() => ++gameUpdateCounter);
  for (;;) {
    if (showBoard) {
      rl.write(`\n${renderBoard(ttt.state.board)}\n`);
    }
    showBoard = false;

    if (!ttt.inProgress) {
      break;
    }
    if (!ttt.myTurn) {
      rl.write('.');
      await sleep(250);
      continue;
    }
    rl.write(`\nYour turn.\n${renderBoard(ttt.state.board)}\n`);

    let coords = '?x?';
    for (;;) {
      coords = await rl.questionAsync('Enter column and row (eg. 1x3): ');
      if (/^[123]x[123]$/.test(coords)) {
        break;
      }
      rl.write(`Invalid response: ${coords}\n`);
    }

    const currentGameUpdateCounter = gameUpdateCounter;
    await ttt.move(Number(coords[0]) - 1, Number(coords[2]) - 1);
    while (currentGameUpdateCounter === gameUpdateCounter) {
      rl.write('.');
      await sleep(250);
    }
    showBoard = true;
  }

  //
  // Display result
  //
  if (ttt.abandoned) {
    rl.write('\nGame has been abandoned\n');
    return;
  }

  // Notify the dashboard that the game has completed.
  await dashboard.submitGameState(ttt.gamePublicKey);

  rl.write(`\nGame Over\n=========\n\n${renderBoard(ttt.state.board)}\n\n`);
  if (ttt.winner) {
    rl.write('You won!\n');
  } else if (ttt.draw) {
    rl.write('Draw.\n');
  } else {
    rl.write('You lost.\n');
  }
}

main(url)
  .catch(err => {
    console.error(err);
  })
  .then(() => process.exit());
