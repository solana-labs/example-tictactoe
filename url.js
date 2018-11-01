// @flow

export let url = process.env.LIVE
  ? 'http://testnet.solana.com:8899'  //TODO: 'https://api.testnet.solana.com';
  :  'http://localhost:8899';
