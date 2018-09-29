# Example Tic-tac-toe

This project demonstrates how to use the [Solana Javascript API](https://github.com/solana-labs/solana-web3.js)
to implement an interactive tic-tac-toe game between two users.

The Solana tic-tac-toe program itself consists of two on-chain programs:
* A single tig-tac-toe game between two players: https://github.com/solana-labs/solana/tree/v0.9/src/tictactoe_program.rs
* Dashboard used by players to find an opponent and view recent game results: https://github.com/solana-labs/solana/tree/v0.9/src/tictactoe_dashboard_program.rs

## Interactive Command-line Usage

This example connects to a local instance of Solana by default. Edit the `url`
variable in `url.js` if this is not desired.

First setup a local instance of Solana:
```bash
$ git clone https://github.com/solana-labs/solana.git
$ cd solana/
$ ./multinode-demo/setup.sh
$ ./multinode-demo/drone.sh &
$ ./multinode-demo/leader.sh
```
For more details see the full [instructions](https://github.com/solana-labs/solana/#testnet-demos).

Then clone this repository and run `npm install`.

Finally run `npm start` twice in different terminals on the same machine, one for each player.

