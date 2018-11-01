# Tic-Tac-Toe on Solana

This project demonstrates how to use the [Solana Javascript API](https://github.com/solana-labs/solana-web3.js)
to implement an interactive tic-tac-toe game between two users.

Two variants of the Solana tic-tac-toe program are available:
* BPF program written in C. See https://github.com/solana-labs/example-tictactoe/tree/master/program-bpf
* Native program written in Rust.  *This variant is only available on a local
  instance of Solana and cannot be deployed to the public testnet.*  See https://github.com/solana-labs/example-tictactoe/tree/master/program-native

## Getting Started
Go to https://solana-example-tictactoe.herokuapp.com/ and wait for another player to join.

### Development

First fetch the npm dependencies by running:
```sh
$ npm install
```

The example connects to a local Solana network by default.  To connect to the
public testnet, `export LIVE=1` in your environment.

To start a local Solana network run:
```bash
$ npx solana-localnet update
$ npm run localnet:up
$ npm run localnet:logs
```
For more details see the [full instructions](https://github.com/solana-labs/solana-web3.js#local-network)
for working with a local network.

#### BPF C program
Ensure clang 7 is installed.  See https://github.com/solana-labs/solana/tree/master/programs/bpf/c/sdk#prerequisites

To compile:
```sh
$ cd program-bpf/
$ make
```
or
```
$ npm run build:bpf
```

The BPF program will then be automatically redeployed when the front end is next
started.

#### Native Rust program
Ensure rust and cargo are installed (see https://rustup.rs/ for more)

To compile:
```sh
$ ./program-native/build.sh
```
or
```
$ npm run build:native
```

Then run the following commands to deploy to a local Solana network:
```sh
$ npm run localnet:up
$ npm run localnet:deloy
```

Note: the local network must be restarted any time the native program is changed
as redeploys of native programs are not supported.

Ensure `export NATIVE=1` is defined in your environment before
starting the front end to select the native program.

#### Command-line front end
After building the program,

```sh
$ npm run start
```

Now wait for another player to join.

#### WebApp front end
After building the program,

```sh
$ npm run dev
```

Then open your browser to http://localhost:8080/ and wait for another player to join.
