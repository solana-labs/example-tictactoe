/**
 * http server entrypoint
 *
 * This http server exists only to dynamically serve /config.json containing the
 * latest Dashboard public key
 */
import bodyParser from 'body-parser';
import express from 'express';
import jayson from 'jayson';
import path from 'path';
import {Connection} from '@solana/web3.js';
import {struct} from 'superstruct';

import {findDashboard} from './config';
import {sleep} from '../util/sleep';
import {url} from '../../url';

const port = process.env.PORT || 8080;
const app = express();

async function getDashboard() {
  console.log('Using', url);
  const connection = new Connection(url);
  return await findDashboard(connection);
}

app.get('/config.json', async (req, res) => {
  console.log('findDashboard request');
  try {
    const dashboard = await getDashboard();
    res
      .send(
        JSON.stringify({
          secretKey: Buffer.from(
            dashboard._dashboardAccount.secretKey,
          ).toString('hex'),
        }),
      )
      .end();
  } catch (err) {
    console.log('findDashboard failed:', err);
    res.status(500).end();
  }
});
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, '../../dist')));

async function loadDashboard() {
  for (;;) {
    try {
      console.log('loading dashboard');
      const dashboard = await getDashboard();
      const publicKey = dashboard.publicKey.toBase58();
      console.log('dashboard loaded:', publicKey);
      return;
    } catch (err) {
      console.log('findDashboard at startup failed:', err);
    }
    await sleep(500);
  }
}

const rpcServer = jayson.server({
  ping: (rawargs, callback) => {
    try {
      console.log('ping rawargs', rawargs);
      const pingMessage = struct([struct.literal('hi')]);
      const args = pingMessage(rawargs);
      console.log('ping args', args);
      callback(null, 'pong');
    } catch (err) {
      console.log('ping failed:', err);
      callback(err);
    }
  },
});

app.use(rpcServer.middleware());

loadDashboard();
app.listen(port);
console.log('Listening on port', port);
