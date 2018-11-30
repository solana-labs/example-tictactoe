// @noflow

const sdkChannel = require('@solana/web3.js/package.json')['solana-channel'];
const {LIVE} = process.env;

if (sdkChannel !== 'beta' && LIVE) {
  // https://api.testnet.solana.com runs the beta channel and we currently have
  // no equivalent for the edge channel
  throw new Error(
    'LIVE not available as SDK channel is currently not set to "beta"',
  );
}

export let url = LIVE
  ? 'https://api.testnet.solana.com'
  : 'http://localhost:8899';
