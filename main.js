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
  return promptRegEx(rl, promptMessage, /^[1-9A-Za-z]{44}$/);
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
    rl.write('\nYou are X.  Ask O for their identifier.\n\n');

    const player2Pubkey = await promptPublicKey(rl, 'O identifier: ');

    ttt = await TicTacToe.Create(connection, myAccount, player2Pubkey);

    rl.write(`Game is ready.  Share the game code with O:\n\n`);
    rl.write(`    ${ttt.gamePublicKey}\n\n`);

    await sleep(2000);

  } else {
    //
    // O must share their public key with X, then waits for the public key of the
    // game from X
    //
    rl.write('\nYou are O.  Share your identifier with X:\n\n');
    rl.write(`    ${myAccount.publicKey}\n\n`);
    rl.write('and ask them for the game code.\n\n');

    const gamePubkey = await promptPublicKey(rl, 'Game code: ');
    ttt = TicTacToe.Join(connection, myAccount, gamePubkey);
    rl.write('Joined game\n');
  }

  //
  // Main game loop
  //
  for (;;) {
    await ttt.updateGameState();
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
    rl.write('\n');

    const coords = await promptRegEx(
      rl,
      `Your turn:\n${ttt.state.board}\nEnter row and column (eg. 1x3): `,
      /^[123]x[123]$/
    );

    await ttt.move(Number(coords[0]) - 1, Number(coords[2]) - 1);
    await ttt.updateGameState();
    rl.write(`\n${ttt.state.board}\n`);
  }

  //
  // Display result
  //
  if (ttt.state.winner) {
    rl.write('\n\nYou won!\n');
  } else if (ttt.state.draw) {
    rl.write('\n\nDraw.\n');
  } else {
    rl.write('\n\nYou lost.\n');
  }
}
