/**
 *
 * The TicTacToe Dashboard class exported by this file is used to interact with the
 * on-chain tic-tac-toe dashboard program.
 *
 * @flow
 */

import cbor from 'cbor';
import {
  Account,
  PublicKey,
  SystemProgram,
  Transaction,
  sendAndConfirmTransaction
} from '@solana/web3.js';
import type {Connection} from '@solana/web3.js';

import {sleep} from '../util/sleep';
import {createNewAccount} from '../util/create-new-account';
import {TicTacToe} from './tic-tac-toe';

export class TicTacToeDashboard {

  state: {
    pending: PublicKey | null,
    completed: Array<PublicKey>,
    total: number,
  };
  connection: Connection;
  clientAccount: Account;
  publicKey: PublicKey;

  /**
   * @private
   */
  constructor(connection: Connection, publicKey: PublicKey, clientAccount: Account) {
    Object.assign(
      this,
      {
        clientAccount,
        connection,
        publicKey,
      }
    );
  }

  static get programId(): PublicKey {
    return new PublicKey('0x400000000000000000000000000000000000000000000000000000000000000');
  }


  /**
   * @private
   */
  static async _connect(connection: Connection, dashboardPublicKey: PublicKey): Promise<TicTacToeDashboard> {
    const clientAccount = await createNewAccount(connection);
    const dashboard = new TicTacToeDashboard(connection, dashboardPublicKey, clientAccount);
    await dashboard.update();
    return dashboard;
  }

  /**
   * Connects to the dashboard
   */
  static async connect(connection: Connection): Promise<TicTacToeDashboard> {
    const dashboardPublicKey = new PublicKey('0x123456789000000000000000000000000000000000000000000000000000000');

    try {
      const tttd = await TicTacToeDashboard._connect(connection, dashboardPublicKey);
      return tttd;
    } catch (err) {
      console.log(err.message);
    }

    const tempAccount = new Account();
    {
      const signature = await connection.requestAirdrop(tempAccount.publicKey, 1);
      const status = await connection.getSignatureStatus(signature);
      if (status !== 'Confirmed') {
        throw new Error(`Transaction ${signature} was not confirmed (${status})`);
      }
    }

    // Allocate memory for the game.
    {
      const transaction = SystemProgram.createAccount(
        tempAccount.publicKey,
        dashboardPublicKey,
        1,
        512, // userdata space
        TicTacToeDashboard.programId,
      );
      await sendAndConfirmTransaction(connection, tempAccount, transaction);
    }

    return TicTacToeDashboard._connect(connection, dashboardPublicKey);
  }

  /**
   * Request the dashboard to recompute its state from the provided game
   */
  async submitGameState(gamePublicKey: PublicKey): Promise<void> {
    const transaction = new Transaction().add({
      keys: [this.clientAccount.publicKey, this.publicKey, gamePublicKey],
      programId: TicTacToeDashboard.programId,
    });
    await sendAndConfirmTransaction(this.connection, this.clientAccount, transaction);
  }

  /**
   * Update the `state` field with the latest dashboard contents
   */
  async update(): Promise<void> {
    const accountInfo = await this.connection.getAccountInfo(this.publicKey);

    const {userdata} = accountInfo;
    const length = userdata.readUInt16LE(0);
    if (length + 2 >= userdata.length) {
      throw new Error(`Invalid game state`);
    }

    this.state = {
      pending: null,
      completed: [],
      total: 0
    };
    if (length > 0) {
      // TODO: Use joi or superstruct to validate input
      const rawState = cbor.decode(userdata.slice(2));
      //console.log(JSON.stringify(rawState));

      // Map public keys byte public keys into base58
      this.state.pending = new PublicKey(rawState.pending);
      this.state.completed = rawState.completed.map((a) => new PublicKey(a));
      this.state.total = rawState.total;
    }
  }

  /**
   * Finds another player and starts a game
   */
  async startGame(): Promise<TicTacToe> {

    const myAccount: Account = await createNewAccount(this.connection);
    const myGame = await TicTacToe.create(this.connection, myAccount);

    // Look for pending games from others, while trying to advertise our game.
    for (;;) {
      await Promise.all([myGame.updateGameState(), this.update()]);

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

