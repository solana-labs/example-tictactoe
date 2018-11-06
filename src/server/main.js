/**
 * http server entrypoint
 *
 * This http server exists only to dynamically serve /config.json containing the
 * latest Dashboard public key
 */
import express from 'express';
import path from 'path';
import {Connection} from '@solana/web3.js';

import {findDashboard} from './config';
import {sleep} from '../util/sleep';
import {url} from '../../url';

const port = process.env.PORT || 8080;
const app = express();

async function getDashboardPublicKey() {
  console.log('Using', url);
  const connection = new Connection(url);
  const dashboard = await findDashboard(connection);
  const publicKey = dashboard.publicKey.toBase58();
  return publicKey;
}

app.get('/config.json', async (req, res) => {
  console.log('findDashboard request');
  try {
    const publicKey = await getDashboardPublicKey();
    console.log('findDashboard:', publicKey);
    res.send(JSON.stringify({publicKey})).end();
  } catch (err) {
    console.log('findDashboard failed:', err);
    res.status(500).end();
  }
});
app.use(express.static(path.join(__dirname, '../../dist')));

async function loadDashboard() {
  for (;;) {
    try {
      console.log('loading dashboard');
      const publicKey = await getDashboardPublicKey();
      console.log('dashboard loaded:', publicKey);
      return;
    } catch (err) {
      console.log('findDashboard at startup failed:', err);
    }
    await sleep(500);
  }
}
loadDashboard();

app.listen(port);
console.log('Listening on port', port);
