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
import {struct} from 'superstruct';

import {createDashboard, findDashboard} from './config';
import {sleep} from '../util/sleep';
import {urlTls} from '../../url';

const port = process.env.PORT || 8080;
const app = express();

async function getDashboard(): Promise<Object> {
  try {
    return await findDashboard();
  } catch (err) {
    // ignore
  }

  if (app.locals.creating) {
    return null;
  }

  try {
    app.locals.creating = true;
    return await createDashboard();
  } finally {
    // eslint-disable-next-line require-atomic-updates
    app.locals.creating = false;
  }
}

app.get('/config.json', async (req, res) => {
  try {
    const ret = await getDashboard();
    let response = {
      creating: true,
    };

    if (ret) {
      const {dashboard, commitment} = ret;
      response = {
        url: urlTls,
        commitment,
        secretKey: Buffer.from(dashboard._dashboardAccount.secretKey).toString(
          'hex',
        ),
      };
    }

    res.send(JSON.stringify(response)).end();
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
      const {dashboard} = await getDashboard();
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
