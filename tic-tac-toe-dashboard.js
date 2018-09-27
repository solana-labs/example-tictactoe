/**
 *
 * The TicTacToe Dashboard class exported by this file is used to interact with the
 * on-chain tic-tac-toe dashboard program.
 */

import cbor from 'cbor';
import bs58 from 'bs58';
import {Account, SystemProgram, Transaction} from '@solana/web3.js';

import {sendAndConfirmTransaction} from './send-and-confirm-transaction';

export class TicTacToeDashboard {
  constructor(connection, publicKey) {
    Object.assign(
      this,
      {
        connection,
        publicKey,
      }
    );
  }

  static get programId() {
    return 'GcdayuLaLyrdmUu324nahyv33G5poQdLUEZ1nEytDeP';
  }

  /**
   * Creates a new dashboard
   */
  static async create(connection) {
    const tempAccount = new Account();
    {
      const signature = await connection.requestAirdrop(tempAccount.publicKey, 1);
      const status = await connection.getSignatureStatus(signature);
      if (status !== 'Confirmed') {
        throw new Error(`Transaction ${signature} was not confirmed (${status})`);
      }
    }

    const dashboardAccount = new Account();

    // Allocate memory for the game.
    {
      const transaction = SystemProgram.createAccount(
        tempAccount.publicKey,
        dashboardAccount.publicKey,
        1,
        1024, // userdata space
        TicTacToeDashboard.programId,
      );
      await sendAndConfirmTransaction(connection, tempAccount, transaction);
    }

    const dashboard = new TicTacToeDashboard(connection, dashboardAccount.publicKey);
    return dashboard;
  }

  /**
   * Request the dashboard to recompute its state from the provided games.
   */
  async submitGameState(playerAccount, ...gamePublicKeys) {
    const transaction = new Transaction({
      fee: 0,
      keys: [playerAccount.publicKey, this.publicKey, ...gamePublicKeys],
      programId: TicTacToeDashboard.programId,
      userdata: cbor.encode('FIXME-this-cannot-be-null'), // TODO! This is a bug.  A transaction with no userdata should be accepted...
    });
    await sendAndConfirmTransaction(this.connection, playerAccount, transaction);
  }

  /**
   * Update the `state` field with the latest dashboard contents
   */
  async update() {
    const accountInfo = await this.connection.getAccountInfo(this.publicKey);

    const {userdata} = accountInfo;
    const length = userdata.readUInt16LE(0);
    if (length + 2 >= userdata.length) {
      throw new Error(`Invalid game state`);
    }

    this.state = {
      pending: [],
      active: [],
      completed: [],
      total: 0
    };
    if (length > 0) {
      // TODO: Use joi or superstruct to validate input
      const rawState = cbor.decode(userdata.slice(2));

      // Map public keys byte public keys into base58
      this.state.pending = rawState.pending.map(bs58.encode);
      this.state.active = rawState.active.map(bs58.encode);
      this.state.completed = rawState.completed.map(bs58.encode);
      this.state.total = rawState.total;
    }
  }

  /**
   * Synchronize the dashboard
   */
  async sync(playerAccount) {
    // Fetch the current state
    await this.update();

    // Provide the dashboard read-only access to all the pending/active games,
    // so that it may update itself.
    const gamePublicKeys = this.state.pending.concat(this.state.active);
    if (gamePublicKeys.length === 0) {
      return;
    }
    await this.submitGameState(playerAccount, ...gamePublicKeys);

    // Update to (potentially) new state
    await this.update();
  }
}

