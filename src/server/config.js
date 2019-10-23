// @flow

import {BpfLoader, Connection, Account} from '@solana/web3.js';
import fs from 'mz/fs';
import path from 'path';

import {url, urlTls} from '../../url';
import {Store} from './store';
import {TicTacToeDashboard} from '../program/tic-tac-toe-dashboard';
import {newSystemAccountWithAirdrop} from '../util/new-system-account-with-airdrop';

const NUM_RETRIES = 100; /* allow some number of retries */

/**
 * Obtain the Dashboard singleton object
 */
export async function findDashboard(): Promise<Object> {
  const store = new Store();

  console.log(`Using ${url} (${urlTls})`);
  const connection = new Connection(url);
  try {
    const config = await store.load('../../../dist/config.json');
    const dashboard = await TicTacToeDashboard.connect(
      connection,
      new Account(Buffer.from(config.secretKey, 'hex')),
    );
    return {dashboard, connection};
  } catch (err) {
    console.log('findDashboard:', err.message);
  }

  let programId;
  console.log('Using BPF program');
  const elf = await fs.readFile(
    path.join(__dirname, '..', '..', 'dist', 'program', 'tictactoe.so'),
  );

  const [, feeCalculator] = await connection.getRecentBlockhash();
  const fees =
    feeCalculator.lamportsPerSignature *
    (BpfLoader.getMinNumSignatures(elf.length) + NUM_RETRIES);

  const loaderAccount = await newSystemAccountWithAirdrop(connection, fees);

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

  console.log('Dashboard programId:', programId.toString());

  const dashboard = await TicTacToeDashboard.create(connection, programId);
  await store.save('../../../dist/config.json', {
    url: urlTls,
    secretKey: Buffer.from(dashboard._dashboardAccount.secretKey).toString(
      'hex',
    ),
  });
  return {dashboard, connection};
}

if (require.main === module) {
  findDashboard()
    .then(ret => {
      console.log('Dashboard:', ret.dashboard.publicKey.toBase58());
    })
    .then(process.exit)
    .catch(console.error)
    .then(() => 1)
    .then(process.exit);
}
