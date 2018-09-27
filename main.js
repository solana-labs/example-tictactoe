/**
 * Implements the command-line based game interface
 */
import readline from 'readline-promise';
import {Account, Connection} from '@solana/web3.js';

import {sleep} from './sleep';
import {TicTacToe} from './tic-tac-toe';

async function promptRegEx(rl, promptMessage, allowedResponse) {
  for (;;) {
    const response = await rl.questionAsync(promptMessage);
    if (allowedResponse.test(response)) {
      return response;
    }
    rl.write(`Invalid response: ${response}\n`);
  }
}

function promptPublicKey(rl, promptMessage) {
  return promptRegEx(rl, promptMessage, /^[1-9A-Za-z]{43,44}$/);
}


export async function main(url) {
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
  const myAccount = new Account();
  try {
    const signature = await connection.requestAirdrop(myAccount.publicKey, 2);
    const status = await connection.getSignatureStatus(signature);
    if (status !== 'Confirmed') {
      throw new Error(`Transaction ${signature} was not confirmed (${status})`);
    }
  } catch (err) {
    rl.write(`failed\n${err.message}\n`);
    return;
  }
  rl.write('ok\n\n');

  //
  // X or O?
  //
  const xOrO = await promptRegEx(rl, 'Do you want to be X or O? ', /^[oOxX]$/);

  let ttt;
  if (xOrO.toLowerCase() === 'x') {
    //
    // X initiates the game with the public key from O
    //
    //    rl.write('\nYou are X.  Ask O for their identifier.\n\n');
    //
    //    const player2Pubkey = await promptPublicKey(rl, 'O identifier: ');
    //
    ttt = await TicTacToe.create(connection, myAccount);

    rl.write(`\nGame created.  Share the game code with O:\n\n`);
    rl.write(`    ${ttt.gamePublicKey}\n\n`);
    rl.write(`Waiting for O to join`);
    try {
      for (;;) {
        await ttt.updateGameState();

        if (ttt.state.gameState === 'WaitingForO') {
          rl.write('.');
        } else if (ttt.state.gameState === 'ORequestPending') {
          rl.write(`\nAccepting game request from ${ttt.state.playerO}\n`);
          await ttt.accept();
        } else {
          break; // Game accepted by X
        }

        // For now it's necessary to poll the network for state changes, check
        // twice a second.
        await sleep(500);
      }

    } catch (err) {
      rl.write(`Unable to locate player O: ${err}\n`);
      return;
    }

  } else {
    rl.write('\nYou are O.  Ask X for the game code:\n\n');
    const gamePubkey = await promptPublicKey(rl, 'Game code: ');

    rl.write(`Requesting to join game`);
    try {
      ttt = await TicTacToe.join(connection, myAccount, gamePubkey);

      for (;;) {
        await ttt.updateGameState();
        if (ttt.state.inProgress) {
          break; // Game accepted by X
        }

        if (ttt.state.gameState !== 'ORequestPending') {
          throw new Error(`Improper game state: ${ttt.state.gameState}`);
        }

        rl.write('.');
        // For now it's necessary to poll the network for state changes, check
        // twice a second.
        await sleep(500);
      }

    } catch (err) {
      rl.write(`Unable to join game: ${err}\n`);
      return;
    }
    rl.write(`\nGame started with ${ttt.state.playerX}\n`);
  }

  //
  // Main game loop
  //
  rl.write('The game has started.\n');
  let showBoard = false;
  for (;;) {
    await ttt.updateGameState();
    if (showBoard) {
      rl.write(`\n${ttt.state.board}\n`);
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
    rl.write(`\nYour turn.\n${ttt.state.board}\n`);
    const coords = await promptRegEx(
      rl,
      'Enter row and column (eg. 1x3): ',
      /^[123]x[123]$/
    );

    await ttt.move(Number(coords[0]) - 1, Number(coords[2]) - 1);
    showBoard = true;
  }

  //
  // Display result
  //
  rl.write(`\nGame Over\n=========\n\n${ttt.state.board}\n\n`);
  if (ttt.state.winner) {
    rl.write('You won!\n');
  } else if (ttt.state.draw) {
    rl.write('Draw.\n');
  } else {
    rl.write('You lost.\n');
  }
}
