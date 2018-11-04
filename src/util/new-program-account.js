// @flow

import {
  Account,
  Connection,
  SystemProgram,
} from '@solana/web3.js';
import type {
  PublicKey,
} from '@solana/web3.js';

import {sendAndConfirmTransaction} from './send-and-confirm-transaction';

/**
 * Allocates a new Account with the specified programId and userdata space
 *
 * @param connection The connection to use
 * @param from Source token account
 * @param programId Program id to assign to the account
 * @param space Userdata space to allocate in the account
 * @return The newly created Account
 *
 * @private
 */
export async function newProgramAccount(
  connection: Connection,
  from: Account,
  programId: PublicKey,
  space: number
): Promise<Account> {

  const stateAccount = new Account();
  const transaction = SystemProgram.createAccount(
    from.publicKey,
    stateAccount.publicKey,
    1,
    space,
    programId
  );
  await sendAndConfirmTransaction(
    'SystemProgram.createAccount',
    connection,
    from,
    transaction
  );
  return stateAccount;
}

