/**
 * Webapp entrypoint
 */
import fetch from 'node-fetch';
import React from 'react';
import ReactDOM from 'react-dom';
import {Well} from 'react-bootstrap';
import {Connection, Account} from '@solana/web3.js';

import {Game} from './Game';
import {TicTacToeDashboard} from '../program/tic-tac-toe-dashboard';
import {sleep} from '../util/sleep';

class App extends React.Component {
  state = {
    initialized: false,
    initMessage: '',
  };

  initialize = async () => {
    await sleep(0); // Exit caller's stack frame

    let attempt = 0;
    let initMessage = 'Fetching configuration...';

    for (;;) {
      let config;

      try {
        this.setState({
          initialized: false,
          initMessage,
        });

        // Load the dashboard account from the server so it remains the
        // same for all users
        const configUrl = window.location.origin + '/config.json';
        const response = await fetch(configUrl);
        if (!response.ok) {
          throw new Error(
            `Config fetch request failed with code: ${response.status}`,
          );
        }

        let jsonResponse = await response.json();
        if (jsonResponse.creating) {
          initMessage = 'Waiting for app to initialize...';
          await sleep(1000);
          continue;
        } else {
          config = jsonResponse;
        }
      } catch (err) {
        console.error(err);
        await sleep(1000);
        continue;
      }

      try {
        const url = config.url;
        this.setState({
          initMessage:
            `Connecting to ${url}... ` + (attempt === 0 ? '' : `(#${attempt})`),
        });
        const connection = new Connection(url);
        await connection.getRecentBlockhash();

        this.setState({initMessage: `Loading dashboard state...`});
        const dashboard = await TicTacToeDashboard.connect(
          connection,
          new Account(Buffer.from(config.secretKey, 'hex')),
        );

        this.setState({initialized: true, dashboard});
        break;
      } catch (err) {
        console.log(err);
        await sleep(1000);
        attempt++;
      }
    }
  };

  componentDidMount() {
    this.initialize();
  }

  render() {
    if (!this.state.initialized) {
      return <Well>{this.state.initMessage}</Well>;
    }
    return (
      <Game reconnect={this.initialize} dashboard={this.state.dashboard} />
    );
  }
}

ReactDOM.render(<App />, document.getElementById('app'));
module.hot.accept();
