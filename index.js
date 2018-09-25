import {main} from './main';

let url = 'http://localhost:8899';
//url = 'https://api.testnet.solana.com';

main(url)
.catch((err) => {
  console.error(err);
})
.then(() => process.exit());
