// @flow

import {
  Connection,
  Transaction,
} from '@solana/web3.js';

import type {
  Account,
} from '@solana/web3.js';


import {sleep} from './sleep';

/**
 * Sign, send and confirm a transaction
 */
export async function sendAndConfirmTransaction(
  connection: Connection,
  from: Account,
  transaction: Transaction,
  runtimeErrorOk: boolean = false
): Promise<void> {
  const signature = await connection.sendTransaction(from, transaction);

  // Wait up to a couple seconds for a confirmation
  let i = 4;
  for (;;) {
    const status = await connection.getSignatureStatus(signature);
    if (status == 'Confirmed') return;
    if (runtimeErrorOk && status == 'ProgramRuntimeError') return;
    await sleep(500);
    if (--i < 0) {
      throw new Error(`Transaction '${signature}' was not confirmed (${status})`);
    }
  }
}

