[![Build status][travis-image]][travis-url]

[travis-image]: https://api.travis-ci.org/solana-labs/example-tictactoe.svg?branch=master
[travis-url]: https://travis-ci.org/solana-labs/example-tictactoe

# Tic-Tac-Toe on Solana

This project demonstrates how to use the [Solana Javascript API](https://github.com/solana-labs/solana-web3.js)
to implement an interactive tic-tac-toe game between two users.

* The on-chain portion is a BPF program written in C, see `program-bpf/`
* Command-line and web front-ends are provided under `src/`

## Getting Started
Go to https://solana-example-tictactoe.herokuapp.com/ and wait for another player to join.

### Development

First fetch the npm dependencies by running:
```sh
$ npm install
```

#### Select a Network
The example connects to a local Solana network by default.

To start a local Solana network run:
```bash
$ npx solana-localnet update
$ npm run localnet:up
```
For more details see the [full instructions](https://github.com/solana-labs/solana-web3.js#local-network)
for working with a local network.

Alternatively to connect to the public testnet, `export LIVE=1` in your environment before running the front-end.

#### Build the BPF C program
Ensure clang 7 is installed.  See https://github.com/solana-labs/solana/tree/master/programs/bpf/c/sdk#prerequisites

```sh
$ V=1 make -C program-bpf
```
or
```
$ npm run build:bpf
```

#### Run the command-line front end
After building the program,

```sh
$ npm run start
```

Now wait for another player to join.

#### Run the WebApp front end
After building the program,

```sh
$ npm run dev
```

Then open your browser to http://localhost:8080/ and wait for another player to join.
