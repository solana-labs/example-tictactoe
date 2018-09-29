# Tic-Tac-Toe on Solana

This project demonstrates how to use the [Solana Javascript API](https://github.com/solana-labs/solana-web3.js)
to implement an interactive tic-tac-toe game between two users.

The Solana tic-tac-toe program itself consists of two on-chain programs:
* A single tig-tac-toe game between two players: https://github.com/solana-labs/solana/tree/v0.9/src/tictactoe_program.rs
* Dashboard used by players to find an opponent and view recent game results: https://github.com/solana-labs/solana/tree/v0.9/src/tictactoe_dashboard_program.rs

## Interactive Command-line Usage

```sh
$ npm install
$ npm start
```

Now wait for another player to join or run `npm start` again in a different
terminal to simulate a second player.

## Network Selection

The example connects to the Solana public testnet.

Edit the file `url.js` if this is not desired.  For example to use a local
instance of Solana, set
set `url = 'http://localhost:8899'` then:
```bash
$ git clone https://github.com/solana-labs/solana.git
$ cd solana/
$ ./multinode-demo/setup.sh
$ ./multinode-demo/drone.sh &
$ ./multinode-demo/leader.sh
```
For more details see the full [instructions](https://github.com/solana-labs/solana/#testnet-demos).

