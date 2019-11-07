// @flow

import {BpfLoader, Connection, Account} from '@solana/web3.js';
import fs from 'mz/fs';
import path from 'path';

import {url, urlTls} from '../../url';
import {Store} from './store';
import {TicTacToeDashboard} from '../program/tic-tac-toe-dashboard';
import {newSystemAccountWithAirdrop} from '../util/new-system-account-with-airdrop';

const NUM_RETRIES = 500; /* allow some number of retries */

/**
 * Obtain the Dashboard singleton object
 */
export async function findDashboard(): Promise<Object> {
  const store = new Store();
  const connection = new Connection(url);
  const config = await store.load('../../../dist/config.json');
  const dashboard = await TicTacToeDashboard.connect(
    connection,
    new Account(Buffer.from(config.secretKey, 'hex')),
  );
  return {dashboard, connection};
}

/**
 * Load the TTT program and then create the Dashboard singleton object
 */
export async function createDashboard(): Promise<Object> {
  const store = new Store();
  const connection = new Connection(url);

  const elf = await fs.readFile(
    path.join(__dirname, '..', '..', 'dist', 'program', 'tictactoe.so'),
  );

  const [, feeCalculator] = await connection.getRecentBlockhash();
  const fees =
    feeCalculator.lamportsPerSignature *
    (BpfLoader.getMinNumSignatures(elf.length) + NUM_RETRIES);
  const loaderAccount = await newSystemAccountWithAirdrop(connection, fees);

  let programId;
  let attempts = 5;
  while (attempts > 0) {
    try {
      console.log('Loading BPF program...');
      programId = await BpfLoader.load(connection, loaderAccount, elf);
      break;
    } catch (err) {
      attempts--;
      console.log(
        `Error loading BPF program, ${attempts} attempts remaining:`,
        err.message,
      );
    }
  }

  if (!programId) {
    throw new Error('Unable to load program');
  }

  console.log('Creating dashboard for programId:', programId.toString());
  const dashboard = await TicTacToeDashboard.create(connection, programId);
  await store.save('../../../dist/config.json', {
    url: urlTls,
    secretKey: Buffer.from(dashboard._dashboardAccount.secretKey).toString(
      'hex',
    ),
  });
  return {dashboard, connection};
}

/**
 * Used when invoking from the command line. First checks for existing dashboard,
 * if that fails, attempts to create a new one.
 */
export async function fetchDashboard(): Promise<Object> {
  try {
    let ret = await findDashboard();
    console.log('Dashboard:', ret.dashboard.publicKey.toBase58());
    process.exit();
  } catch (err) {
    // ignore error, try to create instead
  }

  try {
    let ret = await createDashboard();
    console.log('Dashboard:', ret.dashboard.publicKey.toBase58());
    process.exit();
  } catch (err) {
    console.error('Failed to create dashboard: ', err);
    process.exit(1);
  }
}

if (require.main === module) {
  fetchDashboard();
}
