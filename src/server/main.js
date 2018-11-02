import express from 'express';
import path from 'path';
import {Connection} from '@solana/web3.js';

import {findDashboard} from './config';
import {url} from '../../url';

const port = process.env.PORT || 8080;
const app = express();

app.get('/config.json', async (req, res) => {
  console.log('findDashboard request');
  try {
    const connection = new Connection(url);
    const dashboard = await findDashboard(connection);
    const publicKey = dashboard.publicKey.toBase58();
    console.log('findDashboard:', publicKey);
    res.send(JSON.stringify({publicKey})).end();
  } catch (err) {
    console.log('findDashboard failed:', err);
    res.status(500).end();
  }

});
app.use(express.static(path.join(__dirname, '../../dist')));

app.listen(port);
console.log('Listening on port', port);
