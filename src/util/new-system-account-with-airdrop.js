// @flow

import {
  Account,
  Connection,
} from '@solana/web3.js';

/**
 * Create a new system account and airdrop it some platform tokens
 *
 * @private
 */
export async function newSystemAccountWithAirdrop(connection: Connection, amount: number = 1): Promise<Account> {
  const account = new Account();
  await connection.requestAirdrop(account.publicKey, amount);
  return account;
}

