/**
 *
 * The TicTacToe Dashboard class exported by this file is used to interact with the
 * on-chain tic-tac-toe dashboard program.
 *
 * @flow
 */

import cbor from 'cbor';
import EventEmitter from 'event-emitter';
import {
  Account,
  PublicKey,
  Transaction,
  sendAndConfirmTransaction
} from '@solana/web3.js';
import type {
  AccountInfo,
  Connection,
} from '@solana/web3.js';

import {
  loadNativeProgram,
  newProgramAccount,
  newSystemAccountWithAirdrop,
  sleep,
} from '../util';
import {TicTacToe} from './tic-tac-toe';

export class TicTacToeDashboard {

  state: {
    pending: PublicKey | null,
    completed: Array<PublicKey>,
    total: number,
  };
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
      pending: null,
      completed: [],
      total: 0,
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
  static async create(connection: Connection): Promise<TicTacToeDashboard> {
    const tempAccount = await newSystemAccountWithAirdrop(connection, 123);

    console.log('dashboard load');
    const programId = await loadNativeProgram(connection, tempAccount, 'tictactoe');
    console.log('dashboard load: programId', programId.toString());
    const dashboardAccount = await newProgramAccount(
      connection,
      tempAccount,
      programId,
      512, // userdata space
    );

    {
      const transaction = new Transaction().add({
        keys: [dashboardAccount.publicKey, dashboardAccount.publicKey],
        programId,
        userdata: cbor.encode('InitDashboard'),
      });
      await sendAndConfirmTransaction(connection, dashboardAccount, transaction);
    }

    const dashboard = new TicTacToeDashboard(
      connection,
      programId,
      dashboardAccount.publicKey,
      tempAccount
    );
    //    await dashboard.update();
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
    dashboard._update(accountInfo);
    return dashboard;
  }

  /**
   * Request the dashboard to recompute its state from the provided game
   */
  async submitGameState(gamePublicKey: PublicKey): Promise<void> {
    const transaction = new Transaction().add({
      keys: [this.clientAccount.publicKey, this.publicKey, gamePublicKey],
      programId: this.programId,
    });
    await sendAndConfirmTransaction(this.connection, this.clientAccount, transaction);
  }

  /**
   * @private
   */
  _update(accountInfo: AccountInfo) {
    const {userdata} = accountInfo;
    const length = userdata.readUInt32LE(0);
    if (length + 4 >= userdata.length) {
      throw new Error(`Invalid dashboard state length`);
    }

    this.state = {
      pending: null,
      completed: [],
      total: 0
    };
    if (length > 0) {
      const tttAccount = cbor.decode(userdata.slice(4));
      //console.log(JSON.stringify(tttAccount));
      if (tttAccount[0] !== 'Dashboard') {
        throw new Error(`Invalid dashboard state type: ${tttAccount[0]}`);
      }
      const dashboardState = tttAccount[1];

      // Map public keys byte public keys into base58
      this.state.pending = new PublicKey(dashboardState.pending);
      this.state.completed = dashboardState.completed.map((a) => new PublicKey(a));
      this.state.total = dashboardState.total;
    }
  }

  /**
   * @private
   */
  _onAccountChange(accountInfo: AccountInfo) {
  //  console.log('ttt dash: onAccountUpdate', JSON.stringify(accountInfo));
    this._update(accountInfo);
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
      if (myGame.state.inProgress) {
        // Another player joined our game
        console.log(`Another player accepted our game (${myGame.gamePublicKey.toString()})`);
        break;
      }

      const pendingGamePublicKey = this.state.pending;
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
            if (theirGame.state.inProgress && theirGame.state.playerO !== null) {
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

        // Advertise myGame as the pending game for others to see and hopefully
        // join
        console.log(`Advertising our game (${myGame.gamePublicKey.toString()})`);
        await this.submitGameState(myGame.gamePublicKey);
      }

      // Wait for a bite
      await sleep(500);
    }
    return myGame;
  }
}

