// @flow

import {BpfLoader, Connection, Account} from '@solana/web3.js';
import fs from 'mz/fs';
import path from 'path';
import semver from 'semver';

import {url, urlTls} from '../../url';
import {Store} from './store';
import {TicTacToeDashboard} from '../program/tic-tac-toe-dashboard';
import {newSystemAccountWithAirdrop} from '../util/new-system-account-with-airdrop';

const NUM_RETRIES = 500; /* allow some number of retries */

let connection;
let commitment;

async function getConnection(): Promise<Object> {
  if (connection) return {connection, commitment};

  let newConnection = new Connection(url);
  const version = await newConnection.getVersion();

  // commitment params are only supported >= 0.21.0
  const solanaCoreVersion = version['solana-core'].split(' ')[0];
  if (semver.gte(solanaCoreVersion, '0.21.0')) {
    commitment = 'recent';
    newConnection = new Connection(url, commitment);
  }

  // eslint-disable-next-line require-atomic-updates
  connection = newConnection;
  return {connection, commitment};
}

/**
 * Obtain the Dashboard singleton object
 */
export async function findDashboard(): Promise<Object> {
  const store = new Store();
  const {connection, commitment} = await getConnection();
  const config = await store.load('../../../dist/config.json');
  const dashboard = await TicTacToeDashboard.connect(
    connection,
    new Account(Buffer.from(config.secretKey, 'hex')),
  );
  return {dashboard, connection, commitment};
}

/**
 * Load the TTT program and then create the Dashboard singleton object
 */
export async function createDashboard(): Promise<Object> {
  const store = new Store();
  const {connection, commitment} = await getConnection();

  let elf;
  try {
    elf = await fs.readFile(
      path.join(__dirname, '..', '..', 'dist', 'program', 'tictactoe.so'),
    );
  } catch (err) {
    console.error(err);
    process.exit(1);
    return;
  }

  const {feeCalculator} = await connection.getRecentBlockhash();
  const balanceNeeded =
    feeCalculator.lamportsPerSignature *
      (BpfLoader.getMinNumSignatures(elf.length) + NUM_RETRIES) +
    (await connection.getMinimumBalanceForRentExemption(elf.length));
  const loaderAccount = await newSystemAccountWithAirdrop(
    connection,
    balanceNeeded,
  );

  let program = new Account();
  let attempts = 5;
  while (attempts > 0) {
    try {
      console.log('Loading BPF program...');
      await BpfLoader.load(connection, loaderAccount, program, elf);
      break;
    } catch (err) {
      program = new Account();
      attempts--;
      console.log(
        `Error loading BPF program, ${attempts} attempts remaining:`,
        err.message,
      );
    }
  }

  if (attempts === 0) {
    throw new Error('Unable to load program');
  }

  const programId = program.publicKey;
  console.log('Creating dashboard for programId:', programId.toString());
  const dashboard = await TicTacToeDashboard.create(connection, programId);
  await store.save('../../../dist/config.json', {
    url: urlTls,
    commitment,
    secretKey: Buffer.from(dashboard._dashboardAccount.secretKey).toString(
      'hex',
    ),
  });
  return {dashboard, connection, commitment};
}

/**
 * Used when invoking from the command line. First checks for existing dashboard,
 * if that fails, attempts to create a new one.
 */
export async function fetchDashboard(): Promise<Object> {
  try {
    let ret = await findDashboard();
    console.log('Dashboard:', ret.dashboard.publicKey.toBase58());
    return ret;
  } catch (err) {
    // ignore error, try to create instead
  }

  try {
    let ret = await createDashboard();
    console.log('Dashboard:', ret.dashboard.publicKey.toBase58());
    return ret;
  } catch (err) {
    console.error('Failed to create dashboard: ', err);
    throw err;
  }
}

if (require.main === module) {
  fetchDashboard()
    .then(process.exit)
    .catch(console.error)
    .then(() => 1)
    .then(process.exit);
}
