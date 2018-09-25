/**
 *
 * The TicTacToe class exported by this file is used to interact with the
 * on-chain tic-tac-toe program.
 */

import cbor from 'cbor';
import bs58 from 'bs58';
import {Account, SystemProgram, Transaction} from '@solana/web3.js';

import {sleep} from './sleep';

/**
 * Sign, send and confirm a transaction
 */
async function sendAndConfirmTransaction(connection, from, transaction) {
  const signature = await connection.sendTransaction(from, transaction);

  // Wait up to a couple seconds for a confirmation
  for (let _ in [1, 2, 3, 4]) { //eslint-disable-line no-unused-vars
    const confirmation = await connection.confirmTransaction(signature);
    if (confirmation) return;
    await sleep(500);
  }
  throw new Error(`Transaction '${signature}' was not confirmed`);
}

export class TicTacToe {

  /**
   * @private
   */
  constructor(connection, gamePublicKey, playerAccount) {
    const state = {
      inProgress: false,
      myTurn: false,
      draw: false,
      winner: false,
      board: '?',
    };

    Object.assign(
      this,
      {
        connection,
        playerAccount,
        gamePublicKey,
        state,
      }
    );
  }

  /**
   * Base-58 encoded program id
   */
  static get programId() {
    return 'CiDwVBFgWV9E5MvXWoLgnEgn2hK7rJikbvfWavzAQz3';
  }

  /**
   * Create a new game as X
   */
  static async Create(connection, player1Account, player2PublicKey) {
    const gameAccount = new Account();
    const ttt = new TicTacToe(connection, gameAccount.publicKey, player1Account);

    // Allocate memory for the game.
    {
      const transaction = SystemProgram.createAccount(
        player1Account.publicKey,
        gameAccount.publicKey,
        1,
        256, // userdata space
        TicTacToe.programId,
      );
      await sendAndConfirmTransaction(connection, player1Account, transaction);
    }

    // Initialize the game
    const cmd = [
      'Init',
      [...Transaction.serializePublicKey(player1Account.publicKey)],
      [...Transaction.serializePublicKey(player2PublicKey)],
    ];
    const userdata = cbor.encode(cmd);

    {
      const transaction = new Transaction({
        fee: 0,
        keys: [gameAccount.publicKey, gameAccount.publicKey],
        programId: TicTacToe.programId,
        userdata,
      });
      await sendAndConfirmTransaction(connection, gameAccount, transaction);
    }
    return ttt;
  }

  /**
   * Join an existing game as O
   */
  static Join(connection, player2Account, gamePublicKey) {
    const ttt = new TicTacToe(connection, gamePublicKey, player2Account);
    return ttt;
  }

  /**
   * Attempt to make a move.
   * Once this method returns, use `updateGameState()` to fetch the result
   */
  async move(x, y) {
    const cmd = [
      'Move',
      [...Transaction.serializePublicKey(this.playerAccount.publicKey)],
      x,
      y,
    ];

    const userdata = cbor.encode(cmd);

    const transaction = new Transaction({
      fee: 0,
      keys: [this.playerAccount.publicKey, this.gamePublicKey],
      programId: TicTacToe.programId,
      userdata,
    });
    await sendAndConfirmTransaction(this.connection, this.playerAccount, transaction);
  }

  /**
   * Update the `state` field with the latest state
   */
  async updateGameState() {
    const accountInfo = await this.connection.getAccountInfo(this.gamePublicKey);

    const {userdata} = accountInfo;
    const length = userdata.readUInt8(0);
    if (length + 1 >= userdata.length) {
      throw new Error(`Invalid game state`);
    }
    const rawGameState = cbor.decode(userdata.slice(1));

    // TODO: Use joi or superstruct for better input validation
    if (typeof rawGameState.game !== 'object') {
      console.log(`Invalid game state: JSON.stringify(rawGameState)`);
      throw new Error('Invalid game state');
    }

    // Map rawGameState into `this.state`
    const {game} = rawGameState;
    const xKey = bs58.encode(game.players[0]);
    const oKey = bs58.encode(game.players[1]);

    // Render the board
    const boardItems = game.grid.map(i => i === 'Free' ? ' ' : i);
    const board = [
      boardItems.slice(0,3).join('|'),
      '-+-+-',
      boardItems.slice(3,6).join('|'),
      '-+-+-',
      boardItems.slice(6,9).join('|'),
    ].join('\n');

    this.state = {
      inProgress: false,
      myTurn: false,
      draw: false,
      winner: false,
      board,
    };

    if (game.state === 'XMove') {
      this.state.inProgress = true;
      if (this.playerAccount.publicKey === xKey) {
        this.state.myTurn = true;
      }
    } else if (game.state === 'OMove') {
      this.state.inProgress = true;
      if (this.playerAccount.publicKey === oKey) {
        this.state.myTurn = true;
      }
    } else {
      if (game.state === 'Draw') {
        this.state.draw = true;
      }
      if (game.state === 'XWon' && this.playerAccount.publicKey === xKey) {
        this.state.winner = true;
      }
      if (game.state === 'OWon' && this.playerAccount.publicKey === oKey) {
        this.state.winner = true;
      }
    }
  }
}

