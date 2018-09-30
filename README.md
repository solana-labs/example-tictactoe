# Tic-Tac-Toe on Solana

This project demonstrates how to use the [Solana Javascript API](https://github.com/solana-labs/solana-web3.js)
to implement an interactive tic-tac-toe game between two users.

The Solana tic-tac-toe program itself consists of two on-chain programs:
* Manages a tic-tac-toe game between two players: https://github.com/solana-labs/solana/tree/v0.9/src/tictactoe_program.rs
* Dashboard used by players to find opponents and fetch recent game results: https://github.com/solana-labs/solana/tree/v0.9/src/tictactoe_dashboard_program.rs

## Getting Started
Go to https://solana-example-tictactoe.herokuapp.com/ and wait for another player to join.

### Local Repository

#### Web App
```sh
$ npm install
$ npm start:webapp
```

Then open your browser to http://localhost:8080/ and wait for another player to join.

#### Command-line
```sh
$ npm install
$ npm start
```

Now wait for another player to join.

## Network Selection
The example connects to the Solana public testnet by default.

Edit the file `url.js` if this is not desired.  For example to use a local
instance of Solana, set
set `url = 'http://localhost:8899'` then:
```bash
$ git clone https://github.com/solana-labs/solana.git -bv0.9
$ cd solana/
$ ./multinode-demo/setup.sh
$ ./multinode-demo/drone.sh &
$ ./multinode-demo/leader.sh
```
For more details see the full [instructions](https://github.com/solana-labs/solana/#testnet-demos).
