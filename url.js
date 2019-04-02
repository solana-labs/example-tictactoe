// @noflow

import {testnetChannelEndpoint} from '@solana/web3.js';

// prettier-ignore
export let url = process.env.TESTNET_IP
  ? 'http://' + process.env.TESTNET_IP + ':8899'
  : process.env.LIVE
    ? testnetChannelEndpoint(process.env.CHANNEL || 'beta')
    : 'http://localhost:8899';
