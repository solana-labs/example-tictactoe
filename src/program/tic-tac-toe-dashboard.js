/**
 *
 * The TicTacToe Dashboard class exported by this file is used to interact with the
 * on-chain tic-tac-toe dashboard program.
 *
 * @flow
 */

import invariant from 'assert';
import EventEmitter from 'event-emitter';
import {
  Account,
  PublicKey,
  Transaction,
  SystemProgram,
  sendAndConfirmRawTransaction,
} from '@solana/web3.js';
import type {AccountInfo, Connection} from '@solana/web3.js';

import {newSystemAccountWithAirdrop} from '../util/new-system-account-with-airdrop';
import {sleep} from '../util/sleep';
import {sendAndConfirmTransaction} from '../util/send-and-confirm-transaction';
import * as ProgramCommand from './program-command';
import {deserializeDashboardState} from './program-state';
import type {DashboardState} from './program-state';
import {TicTacToe} from './tic-tac-toe';

export class TicTacToeDashboard {
  state: DashboardState;
  connection: Connection;
  programId: PublicKey;
  publicKey: PublicKey;
  _dashboardAccount: Account;
  _ee: EventEmitter;
  _changeSubscriptionId: number | null;

  /**
   * @private
   */
  constructor(
    connection: Connection,
    programId: PublicKey,
    dashboardAccount: Account,
  ) {
    const {publicKey} = dashboardAccount;

    const state = {
      pendingGame: null,
      completedGames: [],
      totalGames: 0,
    };
    Object.assign(this, {
      connection,
      programId,
      _dashboardAccount: dashboardAccount,
      publicKey,
      state,
      _changeSubscriptionId: connection.onAccountChange(
        publicKey,
        this._onAccountChange.bind(this),
      ),
      _ee: new EventEmitter(),
    });
  }

  /**
   * Creates a new dashboard
   */
  static async create(
    connection: Connection,
    programId: PublicKey,
  ): Promise<TicTacToeDashboard> {
    const lamports = 10000;
    const fee = 100; // TODO: use FeeCalculator to properly account for the transaction fee
    const tempAccount = await newSystemAccountWithAirdrop(
      connection,
      lamports + fee,
    );

    const dashboardAccount = new Account();

    const transaction = SystemProgram.createAccount(
      tempAccount.publicKey,
      dashboardAccount.publicKey,
      lamports,
      255, // data space
      programId,
    );
    transaction.add({
      keys: [
        {pubkey: dashboardAccount.publicKey, isSigner: true, isDebitable: true},
      ],
      programId,
      data: ProgramCommand.initDashboard(),
    });
    await sendAndConfirmTransaction(
      'initDashboard',
      connection,
      transaction,
      tempAccount,
      dashboardAccount,
    );

    return new TicTacToeDashboard(connection, programId, dashboardAccount);
  }

  /**
   * Connects to an existing dashboard
   */
  static async connect(
    connection: Connection,
    dashboardAccount: Account,
  ): Promise<TicTacToeDashboard> {
    const accountInfo = await connection.getAccountInfo(
      dashboardAccount.publicKey,
    );
    const {owner} = accountInfo;

    const dashboard = new TicTacToeDashboard(
      connection,
      owner,
      dashboardAccount,
    );
    dashboard.state = deserializeDashboardState(accountInfo);
    return dashboard;
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
   * Request a partially signed Transaction that will enable the player to
   * initiate a Game.
   *
   * Note: Although the current implementation of this method is inline, in
   * production this function would issue an RPC request to a server somewhere
   * that hosts the dashboard's secret key.
   *
   * Upon return, the player must sign the Transaction with their secretKey and
   * send it to the cluster.
   */
  async _requestPlayerAccountTransaction(
    playerPublicKey: PublicKey,
  ): Promise<Transaction> {
    const [
      recentBlockhash /*, *feeCalculator*/,
    ] = await this.connection.getRecentBlockhash();
    let transaction = new Transaction({recentBlockhash});
    transaction.add(SystemProgram.assign(playerPublicKey, this.programId), {
      keys: [
        {
          pubkey: this._dashboardAccount.publicKey,
          isSigner: true,
          isDebitable: true,
        },
        {pubkey: playerPublicKey, isSigner: true, isDebitable: true},
      ],
      programId: this.programId,
      data: ProgramCommand.initPlayer(),
    });

    const payerAccount = await newSystemAccountWithAirdrop(
      this.connection,
      100, // TODO: use FeeCalculator to properly account for the transaction fee
    );

    transaction.signPartial(
      payerAccount,
      this._dashboardAccount,
      playerPublicKey,
    );
    return transaction;
  }

  /**
   * Finds another player and starts a game
   */
  async startGame(): Promise<TicTacToe> {
    const playerAccount = new Account();
    const transaction = await this._requestPlayerAccountTransaction(
      playerAccount.publicKey,
    );
    transaction.addSigner(playerAccount);
    await sendAndConfirmRawTransaction(
      this.connection,
      transaction.serialize(),
    );

    let myGame: TicTacToe | null = null;

    // Look for pending games from others, while trying to advertise our game.
    for (;;) {
      if (myGame) {
        if (myGame.inProgress) {
          // Another player joined our game
          console.log(
            `Another player accepted our game (${myGame.gamePublicKey.toString()})`,
          );
          return myGame;
        }

        if (myGame.disconnected) {
          throw new Error('game disconnected');
        }
      }

      const pendingGamePublicKey = this.state.pendingGame;

      if (
        pendingGamePublicKey !== null &&
        (!myGame || !myGame.gamePublicKey.equals(pendingGamePublicKey))
      ) {
        try {
          console.log(`Trying to join ${pendingGamePublicKey.toString()}`);
          const theirGame = await TicTacToe.join(
            this.connection,
            this.programId,
            this.publicKey,
            playerAccount,
            pendingGamePublicKey,
          );
          if (theirGame !== null) {
            console.log(`Joined game ${theirGame.gamePublicKey.toString()}`);
            if (myGame) {
              myGame.abandon();
            }
            return theirGame;
          }
        } catch (err) {
          console.log(err.message);
        }
      }

      if (!myGame) {
        myGame = await TicTacToe.create(
          this.connection,
          this.programId,
          this.publicKey,
          playerAccount,
        );
      }

      if (
        pendingGamePublicKey === null ||
        !myGame.gamePublicKey.equals(pendingGamePublicKey)
      ) {
        // Advertise myGame as the pending game for others to see and join
        console.log(
          `Advertising our game (${myGame.gamePublicKey.toString()})`,
        );
        const transaction = new Transaction().add({
          keys: [
            {
              pubkey: playerAccount.publicKey,
              isSigner: true,
              isDebitable: true,
            },
            {pubkey: this.publicKey, isSigner: false, isDebitable: true},
            {pubkey: myGame.gamePublicKey, isSigner: false, isDebitable: true},
            {
              pubkey: ProgramCommand.getTickHeightPublicKey(),
              isSigner: false,
              isDebitable: false,
            },
          ],
          programId: this.programId,
          data: ProgramCommand.advertiseGame(),
        });
        await sendAndConfirmTransaction(
          'advertiseGame',
          this.connection,
          transaction,
          playerAccount,
        );
      }

      // Wait for a bite
      await sleep(500);
    }
    invariant(false); //eslint-disable-line no-unreachable
  }
}
