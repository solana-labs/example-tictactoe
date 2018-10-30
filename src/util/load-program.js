// @flow

import fs from 'mz/fs';
import path from 'path';
import {
  Account,
  Connection,
  BpfLoader,
  NativeLoader,
} from '@solana/web3.js';
import type {
  PublicKey,
} from '@solana/web3.js';

/**
 * Loads a program
 *
 * @param connection The connection to use
 * @param loaderAccount System account used to load the program
 * @param programName Name of the program to load
 */
export async function loadProgram(
  connection: Connection,
  loaderAccount: Account,
  programName: string
): Promise<PublicKey> {
  if (!process.env.BPF) {
    return await NativeLoader.load(connection, loaderAccount, programName);
  }

  const elf = await fs.readFile(
    path.join(__dirname, '..', '..', 'dist', 'program', programName + '.o')
  );
  return await BpfLoader.load(connection, loaderAccount, elf);
}
