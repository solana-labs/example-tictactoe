// @flow

import {
  BpfLoader,
  Connection,
  NativeLoader,
  PublicKey,
} from '@solana/web3.js';
import fs from 'mz/fs';
import path from 'path';

import {url} from '../../url';
import {Store} from './store';
import {TicTacToeDashboard} from '../program/tic-tac-toe-dashboard';
import {newSystemAccountWithAirdrop} from '../util';

export async function findDashboard(connection: Connection): Promise<TicTacToeDashboard> {
  const store = new Store();
  let native = !!process.env.NATIVE;

  try {
    const config = await store.load('../../../dist/config.json');
    if (config.native === native) {
      const publicKey = new PublicKey(config.publicKey);
      const dashboard = await TicTacToeDashboard.connect(connection, publicKey);
      return dashboard;
    }
  } catch (err) {
    console.log('findDashboard:', err.message);
  }

  const tempAccount = await newSystemAccountWithAirdrop(connection, 123);

  let programId;
  if (native) {
    console.log('Using native program');
    programId = await NativeLoader.load(connection, tempAccount, 'tictactoe');
  } else {
    console.log('Using BPF program');
    const elf = await fs.readFile(
      path.join(__dirname, '..', '..', 'dist', 'program', 'tictactoe.o')
    );
    programId = await BpfLoader.load(connection, tempAccount, elf);
  }

  console.log('dashboard programId:', programId.toString());

  const dashboard = await TicTacToeDashboard.create(connection, programId);
  await store.save(
    '../../../dist/config.json',
    {
      native,
      publicKey: dashboard.publicKey.toBase58()
    },
  );
  return dashboard;
}

if (require.main === module) {
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
