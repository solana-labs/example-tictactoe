/**
 *
 * The TicTacToe Dashboard class exported by this file is used to interact with the
 * on-chain tic-tac-toe dashboard program.
 *
 * @flow
 */

import cbor from 'cbor';
import bs58 from 'bs58';
import {
  Account,
  SystemProgram,
  Transaction,
} from '@solana/web3.js';
import type {
  Connection,
  PublicKey,
} from '@solana/web3.js';

import {sleep} from '../util/sleep';
import {createNewAccount} from '../util/create-new-account';
import {sendAndConfirmTransaction} from '../util/send-and-confirm-transaction';
import {TicTacToe} from './tic-tac-toe';

export class TicTacToeDashboard {

  state: {
    pending: PublicKey,
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
    return 'GcdayuLaLyrdmUu324nahyv33G5poQdLUEZ1nEytDeP';
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
  static async connect(
    connection: Connection,
    dashboardPublicKey: PublicKey = 'GriTuZr9NTaSbTcPR38VDDyLkcPt8mTEut8cspgBjjQZ'
  ): Promise<TicTacToeDashboard> {

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
        1024, // userdata space
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
    const transaction = new Transaction({
      fee: 0,
      keys: [this.clientAccount.publicKey, this.publicKey, gamePublicKey],
      programId: TicTacToeDashboard.programId,
      userdata: cbor.encode('FIXME-this-cannot-be-null'), // TODO! This is a bug.  A transaction with no userdata should be accepted...
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
      pending: '.',
      completed: [],
      total: 0
    };
    if (length > 0) {
      // TODO: Use joi or superstruct to validate input
      const rawState = cbor.decode(userdata.slice(2));
      //console.log(JSON.stringify(rawState));

      // Map public keys byte public keys into base58
      this.state.pending = bs58.encode(rawState.pending);
      this.state.completed = rawState.completed.map(bs58.encode);
      this.state.total = rawState.total;
    }
  }

  /**
   * Finds another player and starts a game
   */
  async startGame(): Promise<TicTacToe> {

    const myAccount = await createNewAccount(this.connection);
    const myGame = await TicTacToe.create(this.connection, myAccount);

    // Look for pending games from others, while trying to advertise our game.
    for (;;) {
      await Promise.all([myGame.updateGameState(), this.update()]);

      if (myGame.state.inProgress) {
        // Another player joined our game
        console.log(`Another player accepted our game (${myGame.gamePublicKey})`);
        break;
      }

      const pendingGamePublicKey = this.state.pending;
      if (pendingGamePublicKey !== myGame.gamePublicKey) {
        try {
          console.log(`Trying to join ${pendingGamePublicKey}`);
          const theirGame = await TicTacToe.join(
            this.connection,
            myAccount,
            this.state.pending
          );
          if (theirGame.state.inProgress) {
            if (theirGame.state.playerO === myAccount.publicKey) {
              console.log(`Joined game ${pendingGamePublicKey}`);
              myGame.abandonGame();
              return theirGame;
            }
          }
        } catch (err) {
          console.log(err.message);
        }

        // Advertise myGame as the pending game for others to see and hopefully
        // join
        console.log(`Advertising our game (${myGame.gamePublicKey})`);
        await this.submitGameState(myGame.gamePublicKey);
      }

      // Wait for a bite
      await sleep(500);
    }
    return myGame;
  }
}

