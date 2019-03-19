// @flow

import {BpfLoader, Connection, NativeLoader, Account} from '@solana/web3.js';
import fs from 'mz/fs';
import path from 'path';

import {url} from '../../url';
import {Store} from './store';
import {TicTacToeDashboard} from '../program/tic-tac-toe-dashboard';
import {newSystemAccountWithAirdrop} from '../util/new-system-account-with-airdrop';

/**
 * Obtain the Dashboard singleton object
 */
export async function findDashboard(
  connection: Connection,
): Promise<TicTacToeDashboard> {
  const store = new Store();
  let native = !!process.env.NATIVE;

  try {
    const config = await store.load('../../../dist/config.json');
    if (config.native === native) {
      const dashboard = await TicTacToeDashboard.connect(
        connection,
        new Account(Buffer.from(config.secretKey, 'hex')),
      );
      return dashboard;
    }
  } catch (err) {
    console.log('findDashboard:', err.message);
  }

  const loaderAccount = await newSystemAccountWithAirdrop(connection, 123);

  let programId;
  if (native) {
    console.log('Using native program');
    programId = await NativeLoader.load(connection, loaderAccount, 'tictactoe');
  } else {
    console.log('Using BPF program');
    const elf = await fs.readFile(
      path.join(__dirname, '..', '..', 'dist', 'program', 'tictactoe.so'),
    );

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
  }
  if (!programId) {
    throw new Error('Unable to load program');
  }

  console.log('Dashboard programId:', programId.toString());

  const dashboard = await TicTacToeDashboard.create(connection, programId);
  await store.save('../../../dist/config.json', {
    native,
    secretKey: Buffer.from(dashboard._dashboardAccount.secretKey).toString(
      'hex',
    ),
  });
  return dashboard;
}

if (require.main === module) {
  console.log('Using', url);
  const connection = new Connection(url);
  findDashboard(connection)
    .then(dashboard => {
      console.log('Dashboard:', dashboard.publicKey.toBase58());
    })
    .then(process.exit)
    .catch(console.error)
    .then(() => 1)
    .then(process.exit);
}
