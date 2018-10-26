// @flow

import {
  Account,
  Connection,
  NativeLoader,
} from '@solana/web3.js';
import type {
  PublicKey,
} from '@solana/web3.js';

/**
 * Map of program names to program Ids
 *
 * @private
 */
const nativeProgramIds: {[string]: PublicKey} = {};

/**
 * Resolves the name of a program into its program Id, loading the program first if necessary
 *
 * @param connection The connection to use
 * @param loaderAccount System account used to load the program
 * @param programName Name of the program to load
 *
 * @private
 */
export async function loadNativeProgram(
  connection: Connection,
  loaderAccount: Account,
  programName: string
): Promise<PublicKey> {
  if (typeof nativeProgramIds[programName] === 'undefined') {
    const programId = await NativeLoader.load(connection, loaderAccount, programName);
    nativeProgramIds[programName] = programId;
  }
  return nativeProgramIds[programName];
}
