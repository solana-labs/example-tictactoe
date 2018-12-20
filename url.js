// @noflow

import {testnetChannelEndpoint} from '@solana/web3.js';

export let url = process.env.LIVE
  ? testnetChannelEndpoint()
  : 'http://localhost:8899';
