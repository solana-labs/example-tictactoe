/**
 *
 * The TicTacToe class exported by this file is used to interact with the
 * on-chain tic-tac-toe program.
 *
 * @flow
 */

import EventEmitter from 'event-emitter';
import {
  Account,
  PublicKey,
  Transaction,
} from '@solana/web3.js';
import type {
  AccountInfo,
  Connection,
} from '@solana/web3.js';

import * as ProgramCommand from './program-command';
import {deserializeGameState} from './program-state';
import type {GameState} from './program-state';
import {
  newProgramAccount,
} from '../util';
import {sendAndConfirmTransaction} from '../util/send-and-confirm-transaction';

export class TicTacToe {
  abandoned: boolean;
  disconnected: boolean;
  connection: Connection;
  programId: PublicKey;
  gamePublicKey: PublicKey;
  isX: boolean;
  playerAccount: Account;
  state: GameState;
  inProgress: boolean;
  myTurn: boolean;
  draw: boolean;
  winner: boolean;
  _keepAliveErrorCount: number;

  _ee: EventEmitter;
  _changeSubscriptionId: number | null;

  /**
   * @private
   */
  constructor(
    connection: Connection,
    programId: PublicKey,
    gamePublicKey: PublicKey,
    isX: boolean,
    playerAccount: Account
  ) {
    const state = {
      board: [],
      gameState: 'Waiting',
      keepAlive: [0, 0],
      playerO: null,
      playerX: null,
    };

    Object.assign(
      this,
      {
        _changeSubscriptionId: null,
        _ee: new EventEmitter(),
        abandoned: false,
        disconnected: false,
        connection,
        draw: false,
        gamePublicKey,
        inProgress: false,
        isX,
        myTurn: false,
        playerAccount,
        programId,
        state,
        winner: false,
        _keepAliveErrorCount: 0,
      }
    );
  }

  /**
   * @private
   */
  scheduleNextKeepAlive() {
    if (this._changeSubscriptionId === null) {
      this._changeSubscriptionId = this.connection.onAccountChange(
        this.gamePublicKey,
        this._onAccountChange.bind(this)
      );
    }
    setTimeout(
      async () => {
        if (this.abandoned || this.disconnected) {
          const {_changeSubscriptionId} = this;
          if (_changeSubscriptionId !== null) {
            this._changeSubscriptionId = null;
            this.connection.removeAccountChangeListener(_changeSubscriptionId);
          }

          //console.log(`\nKeepalive exit, Game abandoned: ${this.gamePublicKey}\n`);
          return;
        }
        if (['XWon', 'OWon', 'Draw'].includes(this.state.gameState)) {
          //console.log(`\nKeepalive exit, Game over: ${this.gamePublicKey}\n`);
          return;
        }
        try {
          await this.keepAlive();
          this._keepAliveErrorCount = 0;
        } catch (err) {
          ++this._keepAliveErrorCount;
          console.error(`keepAlive() failed #${this._keepAliveErrorCount}: ${err}`);
          if (this._keepAliveErrorCount > 3) {
            this.disconnected = true;
            this.inProgress = false;
            this._ee.emit('change');
          }
        }
        this.scheduleNextKeepAlive();
      },
      3000
    );
  }

  /**
   * Creates a new game, costing playerX 1 token
   */
  static async create(connection: Connection, programId: PublicKey, playerXAccount: Account): Promise<TicTacToe> {
    const gameAccount = await newProgramAccount(
      connection,
      playerXAccount,
      programId,
      255, // userdata space
    );

    {
      const transaction = new Transaction().add({
        keys: [gameAccount.publicKey, gameAccount.publicKey, playerXAccount.publicKey],
        programId,
        userdata: ProgramCommand.initGame(),
      });
      await sendAndConfirmTransaction('initGame', connection, gameAccount, transaction);
    }

    const ttt = new TicTacToe(connection, programId, gameAccount.publicKey, true, playerXAccount);
    ttt.scheduleNextKeepAlive();
    return ttt;
  }

  /**
   * Join an existing game as player O
   */
  static async join(
    connection: Connection,
    programId: PublicKey,
    playerOAccount: Account,
    gamePublicKey: PublicKey
  ): Promise<TicTacToe> {
    const ttt = new TicTacToe(connection, programId, gamePublicKey, false, playerOAccount);
    {
      const transaction = new Transaction().add({
        keys: [playerOAccount.publicKey, gamePublicKey],
        programId,
        userdata: ProgramCommand.joinGame(Date.now()),
      });
      await sendAndConfirmTransaction('joinGame', connection, playerOAccount, transaction);
    }

    ttt._onAccountChange(
      await connection.getAccountInfo(gamePublicKey)
    );
    ttt.scheduleNextKeepAlive();
    return ttt;
  }

  /**
   * Send a keep-alive message to inform the other player that we're still alive
   */
  async keepAlive(when: number | null = null): Promise<void> {
    const transaction = new Transaction().add({
      keys: [this.playerAccount.publicKey, this.gamePublicKey],
      programId: this.programId,
      userdata: ProgramCommand.keepAlive(when === null ? Date.now() : when),
    });
    await sendAndConfirmTransaction('keepAlive', this.connection, this.playerAccount, transaction, true);
  }

  /**
   * Signal to the other player that we're leaving
   */
  async abandon(): Promise<void> {
    this.abandoned = true;
    await this.keepAlive(0);
  }

  /**
   * Attempt to make a move.
   */
  async move(x: number, y: number): Promise<void> {
    const transaction = new Transaction().add({
      keys: [this.playerAccount.publicKey, this.gamePublicKey],
      programId: this.programId,
      userdata: ProgramCommand.move(x, y),
    });
    await sendAndConfirmTransaction('move', this.connection, this.playerAccount, transaction, true);
  }

  /**
   * Fetch the latest state of the specified game
   */
  static async getGameState(
    connection: Connection,
    gamePublicKey: PublicKey
  ): Promise<GameState> {
    const accountInfo = await connection.getAccountInfo(gamePublicKey);
    return deserializeGameState(accountInfo);
  }

  isPeerAlive(): boolean {
    const peerKeepAlive = this.state.keepAlive[this.isX ? 1 : 0];
    // Check if the peer has abandoned the game
    return Date.now() - peerKeepAlive < 10000; /* 10 seconds*/
  }

  /**
   * Update the `state` field with the latest state
   *
   * @private
   */
  _onAccountChange(accountInfo: AccountInfo) {
    this.state = deserializeGameState(accountInfo);
    this.inProgress = false;
    this.myTurn = false;
    this.draw = false;
    this.winner = false;

    switch (this.state.gameState) {
    case 'Waiting':
      break;
    case 'XMove':
      this.inProgress = true;
      this.myTurn = this.isX;
      break;
    case 'OMove':
      this.inProgress = true;
      this.myTurn = !this.isX;
      break;
    case 'Draw':
      this.draw = true;
      break;
    case 'XWon':
      this.winner = this.isX;
      break;
    case 'OWon':
      this.winner = !this.isX;
      break;
    default:
      throw new Error(`Unhandled game state: ${this.state.gameState}`);
    }

    if (this.inProgress && !this.isPeerAlive()) {
      this.inProgress = false;
      this.abandoned = true;
    }
    this._ee.emit('change');
  }

  /**
   * Register a callback for notification when the game state changes
   */
  onChange(fn: Function) {
    this._ee.on('change', fn);
  }

  /**
   * Remove a previously registered onChange callback
   */
  removeChangeListener(fn: Function) {
    this._ee.off('change', fn);
  }
}
