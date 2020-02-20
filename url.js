// @noflow

// To connect to a public testnet, set `export LIVE=1` in your
// environment. By default, `LIVE=1` will connect to the beta testnet.

export let url = process.env.LIVE
  ? 'http://devnet.solana.com:8899'
  : 'http://localhost:8899';

export let urlTls = process.env.LIVE
  ? 'https://devnet.solana.com:8899'
  : 'http://localhost:8899';
