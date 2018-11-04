/**
 *
 * The TicTacToe Dashboard class exported by this file is used to interact with the
 * on-chain tic-tac-toe dashboard program.
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

import {
  newProgramAccount,
  newSystemAccountWithAirdrop,
  sleep,
} from '../util';
import {sendAndConfirmTransaction} from '../util/send-and-confirm-transaction';
import * as ProgramCommand from './program-command';
import {deserializeDashboardState} from './program-state';
import type {DashboardState} from './program-state';
import {TicTacToe} from './tic-tac-toe';

export class TicTacToeDashboard {

  state: DashboardState;
  connection: Connection;
  clientAccount: Account;
  programId: PublicKey;
  publicKey: PublicKey;
  _ee: EventEmitter;
  _changeSubscriptionId: number | null;

  /**
   * @private
   */
  constructor(connection: Connection, programId: PublicKey, publicKey: PublicKey, clientAccount: Account) {
    const state = {
      pendingGame: null,
      completedGames: [],
      totalGames: 0,
    };
    Object.assign(
      this,
      {
        clientAccount,
        connection,
        programId,
        publicKey,
        state,
        _changeSubscriptionId: connection.onAccountChange(publicKey, this._onAccountChange.bind(this)),
        _ee: new EventEmitter(),
      }
    );
  }

  /**
   * Creates a new dashboard
   */
  static async create(connection: Connection, programId: PublicKey): Promise<TicTacToeDashboard> {
    const tempAccount = await newSystemAccountWithAirdrop(connection, 123);

    const dashboardAccount = await newProgramAccount(
      connection,
      tempAccount,
      programId,
      256, // userdata space
    );

    {
      const transaction = new Transaction().add({
        keys: [dashboardAccount.publicKey, dashboardAccount.publicKey],
        programId,
        userdata: ProgramCommand.initDashboard(),
      });
      await sendAndConfirmTransaction('initDashboard', connection, dashboardAccount, transaction);
    }

    const dashboard = new TicTacToeDashboard(
      connection,
      programId,
      dashboardAccount.publicKey,
      tempAccount
    );
    return dashboard;
  }


  /**
   * Connects to an existing dashboard
   */
  static async connect(connection: Connection, dashboardPublicKey: PublicKey): Promise<TicTacToeDashboard> {

    const accountInfo = await connection.getAccountInfo(dashboardPublicKey);
    const {programId} = accountInfo;

    const tempAccount = await newSystemAccountWithAirdrop(connection, 123);
    const dashboard = new TicTacToeDashboard(
      connection,
      programId,
      dashboardPublicKey,
      tempAccount
    );
    dashboard.state = deserializeDashboardState(accountInfo);
    return dashboard;
  }

  /**
   * Request the dashboard to recompute its state from the provided game
   */
  async submitGameState(gamePublicKey: PublicKey): Promise<void> {
    const transaction = new Transaction().add({
      keys: [this.clientAccount.publicKey, this.publicKey, gamePublicKey],
      programId: this.programId,
      userdata: ProgramCommand.updateDashboard(),
    });
    await sendAndConfirmTransaction('updateDashboard', this.connection, this.clientAccount, transaction);
  }

  /**
   * @private
   */
  _onAccountChange(accountInfo: AccountInfo) {
    this.state = deserializeDashboardState(accountInfo);
    this._ee.emit('change');
  }

  /**
   * Register a callback for notification when the dashboard state changes
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

  /**
   * Finds another player and starts a game
   */
  async startGame(): Promise<TicTacToe> {
    const myAccount: Account = await newSystemAccountWithAirdrop(this.connection, 123);
    const myGame = await TicTacToe.create(this.connection, this.programId, myAccount);

    // Look for pending games from others, while trying to advertise our game.
    for (;;) {
      if (myGame.inProgress) {
        // Another player joined our game
        console.log(`Another player accepted our game (${myGame.gamePublicKey.toString()})`);
        break;
      }

      if (myGame.disconnected) {
        throw new Error('game disconnected');
      }

      const pendingGamePublicKey = this.state.pendingGame;
      if (pendingGamePublicKey === null || !myGame.gamePublicKey.equals(pendingGamePublicKey)) {
        if (pendingGamePublicKey !== null) {
          try {
            console.log(`Trying to join ${pendingGamePublicKey.toString()}`);
            const theirGame = await TicTacToe.join(
              this.connection,
              this.programId,
              myAccount,
              pendingGamePublicKey,
            );
            if (theirGame.inProgress && theirGame.state.playerO !== null) {
              if (myAccount.publicKey.equals(theirGame.state.playerO)) {
                console.log(`Joined game ${pendingGamePublicKey.toString()}`);
                myGame.abandon();
                return theirGame;
              }
            }
          } catch (err) {
            console.log(err.message);
          }
        }

        // Advertise myGame as the pending game for others to see and join
        console.log(`Advertising our game (${myGame.gamePublicKey.toString()})`);
        await this.submitGameState(myGame.gamePublicKey);
      }

      // Wait for a bite
      await sleep(500);
    }
    return myGame;
  }
}

