// @flow
//
import {
  Connection,
  PublicKey,
} from '@solana/web3.js';

import {url} from '../../url';
import {Store} from './store';
import {TicTacToeDashboard} from '../program/tic-tac-toe-dashboard';


export async function findDashboard(connection: Connection): Promise<TicTacToeDashboard> {
  const store = new Store();

  try {
    const config = await store.load('../../../dist/config.json');
    const publicKey = new PublicKey(config.publicKey);
    const dashboard = await TicTacToeDashboard.connect(connection, publicKey);
    return dashboard;
  } catch (err) {
    console.log('findDashboard:', err.message);
  }

  const dashboard = await TicTacToeDashboard.create(connection);
  await store.save(
    '../../../dist/config.json',
    {
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
  .catch(console.error)
  .then(process.exit);
}
