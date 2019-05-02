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
    this.setState({
      initialized: false,
      initMessage: 'Initializing...',
    });
    await sleep(0); // Exit caller's stack frame

    let connection = null;
    let attempt = 0;

    for (;;) {
      try {
        this.setState({initMessage: `Connecting to dashboard...`});

        // Load the dashboard account from the server so it remains the
        // same for all users
        const configUrl = window.location.origin + '/config.json';
        const response = await fetch(configUrl);
        const config = await response.json();

        const url = config.url;

        this.setState({
          initMessage:
            `Connecting to ${url}... ` + (attempt === 0 ? '' : `(#${attempt})`),
        });
        connection = new Connection(url);
        await connection.getRecentBlockhash();

        this.setState({initMessage: `Loading dashboard state...`});
        const dashboard = await TicTacToeDashboard.connect(
          connection,
          new Account(Buffer.from(config.secretKey, 'hex')),
        );

        this.setState({initialized: true, dashboard});
        break;
      } catch (err) {
        this.setState({
          initMessage: this.state.initMessage + ' - ' + err.message,
        });
        console.log(err);
        connection = null;
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
