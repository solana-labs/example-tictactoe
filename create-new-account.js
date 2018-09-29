// @flow

import {
  Account,
  Connection,
} from '@solana/web3.js';

/**
 * Create a new account with some tokens
 */
export async function createNewAccount(connection: Connection, tokens: number = 100): Promise<Account> {
  const account = new Account();
  const signature = await connection.requestAirdrop(account.publicKey, tokens);
  const status = await connection.getSignatureStatus(signature);
  if (status !== 'Confirmed') {
    throw new Error(`Transaction ${signature} was not confirmed (${status})`);
  }
  return account;
}

