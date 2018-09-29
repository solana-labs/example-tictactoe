/**
 *
 * The TicTacToe class exported by this file is used to interact with the
 * on-chain tic-tac-toe program.
 *
 * @flow
 */

import cbor from 'cbor';
import bs58 from 'bs58';
import {Account, SystemProgram, Transaction} from '@solana/web3.js';
import type {Connection, PublicKey} from '@solana/web3.js';

import {sendAndConfirmTransaction} from './send-and-confirm-transaction';

export type TicTacToeBoard = Array<'F'|'X'|'O'>;

type TicTacToeGameState = {
  gameState: 'Waiting' | 'XMove' | 'OMove' | 'Draw' | 'XWin' | 'OWin';
  inProgress: boolean,
  myTurn: boolean,
  draw: boolean,
  winner: boolean,
  board: TicTacToeBoard,
  playerX: PublicKey | null,
  playerO: PublicKey | null,
  keep_alive: [number, number],
};

export class TicTacToe {
  abandoned: boolean;
  connection: Connection;
  gamePublicKey: PublicKey;
  isX: boolean;
  playerAccount: Account;
  state: TicTacToeGameState;


  /**
   * @private
   */
  constructor(
    connection: Connection,
    gamePublicKey: PublicKey,
    isX: boolean,
    playerAccount: Account
  ) {
    const state = {
      gameState: 'Waiting',
      inProgress: false,
      myTurn: false,
      draw: false,
      winner: false,
      playerX: null,
      playerO: null,
      board: [],
      keep_alive: [0, 0],
    };

    Object.assign(
      this,
      {
        abandoned: false,
        connection,
        isX,
        playerAccount,
        gamePublicKey,
        state,
      }
    );
  }

  /**
   * @private
   */
  scheduleNextKeepAlive() {
    setTimeout(
      async () => {
        if (this.abandoned) {
          //console.log(`\nKeepalive exit, Game abandoned: ${this.gamePublicKey}\n`);
          return;
        }
        if (['XWon', 'OWin', 'Draw'].includes(this.state.gameState)) {
          //console.log(`\nKeepalive exit, Game over: ${this.gamePublicKey}\n`);
          return;
        }
        try {
          await this.keepAlive();
        } catch (err) {
          console.error(`keepAlive() failed: ${err}`);
        }
        this.scheduleNextKeepAlive();
      },
      1000
    );
  }

  /**
   * Base-58 encoded program id
   */
  static get programId(): PublicKey {
    return 'CiDwVBFgWV9E5MvXWoLgnEgn2hK7rJikbvfWavzAQz3';
  }

  /**
   * Creates a new game, costing playerX 1 token
   */
  static async create(connection: Connection, playerXAccount: Account): Promise<TicTacToe> {
    const gameAccount = new Account();
    const ttt = new TicTacToe(connection, gameAccount.publicKey, true, playerXAccount);

    // Allocate memory for the game.
    {
      const transaction = SystemProgram.createAccount(
        playerXAccount.publicKey,
        gameAccount.publicKey,
        1,
        256, // userdata space
        TicTacToe.programId,
      );
      await sendAndConfirmTransaction(connection, playerXAccount, transaction);
    }

    const userdata = cbor.encode('Init');
    {
      const transaction = new Transaction({
        fee: 0,
        keys: [gameAccount.publicKey, gameAccount.publicKey, playerXAccount.publicKey],
        programId: TicTacToe.programId,
        userdata,
      });
      await sendAndConfirmTransaction(connection, gameAccount, transaction);
    }

    ttt.scheduleNextKeepAlive();
    return ttt;
  }

  /**
   * Join an existing game as player O
   */
  static async join(
    connection: Connection,
    playerOAccount: Account,
    gamePublicKey: PublicKey
  ): Promise<TicTacToe> {
    const ttt = new TicTacToe(connection, gamePublicKey, false, playerOAccount);
    await ttt.updateGameState();
    if (!ttt.isPeerAlive()) {
      throw new Error('Game appears abandoned');
    }

    const userdata = cbor.encode(['Join', Date.now()]);
    {
      const transaction = new Transaction({
        fee: 0,
        keys: [playerOAccount.publicKey, gamePublicKey],
        programId: TicTacToe.programId,
        userdata,
      });
      await sendAndConfirmTransaction(connection, playerOAccount, transaction);
    }

    await ttt.updateGameState();
    ttt.scheduleNextKeepAlive();
    return ttt;
  }

  /**
   * Send a keep-alive message to inform the other player that we're still alive
   */
  async keepAlive(when: ?number = undefined): Promise<void> {
    const cmd = [
      'KeepAlive',
      when === undefined ? Date.now() : when,
    ];
    const userdata = cbor.encode(cmd);

    const transaction = new Transaction({
      fee: 0,
      keys: [this.playerAccount.publicKey, this.gamePublicKey],
      programId: TicTacToe.programId,
      userdata,
    });
    await sendAndConfirmTransaction(this.connection, this.playerAccount, transaction, true);
  }

  /**
   * Signal to the other player that we're leaving
   */
  async abandonGame(): Promise<void> {
    this.abandoned = true;
    await this.keepAlive(0);
  }


  /**
   * Attempt to make a move.
   * Once this method returns, use `updateGameState()` to fetch the result
   */
  async move(x: number, y: number): Promise<void> {
    const cmd = [
      'Move',
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
    await sendAndConfirmTransaction(this.connection, this.playerAccount, transaction, true);
  }

  /**
   * Fetch the latest state of the specified game
   */
  static async getGameState(
    connection: Connection,
    gamePublicKey: PublicKey
  ): Promise<TicTacToeGameState> {
    const accountInfo = await connection.getAccountInfo(gamePublicKey);

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

    const playerX = bs58.encode(game.player_x);
    const playerO = game.player_o ? bs58.encode(game.player_o) : null;

    const state: TicTacToeGameState = {
      gameState: game.state,
      inProgress: false,
      myTurn: false,
      draw: false,
      winner: false,
      playerX,
      playerO,
      board: game.board.map(i => i === 'F' ? ' ' : i),
      keep_alive: game.keep_alive,
    };

    switch (state.gameState) {
    case 'Waiting':
      break;
    case 'XMove':
    case 'OMove':
      state.inProgress = true;
      break;
    case 'Draw':
      state.draw = true;
      break;
    case 'XWon':
    case 'OWon':
      break;
    default:
      throw new Error(`Unhandled game state: ${game.state}`);
    }

    return state;
  }

  /**
   * Update the `state` field with the latest state
   */
  async updateGameState(): Promise<void> {
    this.state = await TicTacToe.getGameState(this.connection, this.gamePublicKey);

    switch (this.state.gameState) {
    case 'Waiting':
      break;
    case 'XMove':
      this.state.myTurn = this.isX;
      break;
    case 'OMove':
      this.state.myTurn = !this.isX;
      break;
    case 'Draw':
      break;
    case 'XWon':
      this.state.winner = this.isX;
      break;
    case 'OWon':
      this.state.winner = !this.isX;
      break;
    default:
      throw new Error(`Unhandled game state: ${this.state.gameState}`);
    }

    if (this.state.inProgress && !this.isPeerAlive()) {
      this.state.inProgress = false;
      this.abandoned = true;
    }
  }

  isPeerAlive(): boolean {
    const peerKeepAlive = this.state.keep_alive[this.isX ? 1 : 0];
    // Check if the peer has abandoned the game
    return Date.now() - peerKeepAlive < 10000; /* 10 seconds*/
  }
}

