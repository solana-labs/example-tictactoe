# Tic-Tac-Toe on Solana

This project demonstrates how to use the [Solana Javascript API](https://github.com/solana-labs/solana-web3.js)
to implement an interactive tic-tac-toe game between two users.

Two variants of the Solana tic-tac-toe program are available:
* BPF program written in C. See https://github.com/solana-labs/example-tictactoe/tree/dev/program-bpf
* Native program written in Rust.  This variant is only available on a local
  instance of Solana and cannot be deployed to teh public testnet.  See https://github.com/solana-labs/example-tictactoe/tree/dev/program-native

## Getting Started
Go to https://solana-example-tictactoe.herokuapp.com/ and wait for another player to join.

### Development

Ensure clang-7 is installed.  See https://github.com/solana-labs/solana/tree/master/programs/bpf/c/sdk#prerequisites

#### Web App
```sh
$ npm install
$ npm run dev
```

Then open your browser to http://localhost:8080/ and wait for another player to join.

#### Command-line
```sh
$ npm install
$ npm run start
```

Now wait for another player to join.

## Network Selection
The example connects to the Solana public testnet by default.

Edit the file `url.js` if this is not desired.  For example to use a local
instance of Solana, set
`url = 'http://localhost:8899'` then run
```bash
$ npx solana-localnet update
$ npx solana-localnet up
```
For more details see the [full instructions](https://github.com/solana-labs/solana-web3.js#local-network)
for working with a local network.
