import fetch from 'node-fetch';
import React from 'react';
import ReactDOM from 'react-dom';
import {
  Well,
} from 'react-bootstrap';
import {
  Connection,
  PublicKey,
} from '@solana/web3.js';

import {Game} from './Game';
import {TicTacToeDashboard} from '../program/tic-tac-toe-dashboard';
import {url} from '../../url';
import {sleep} from '../util/sleep';

class App extends React.Component {
  state = {
    initialized: false,
    initMessage: 'Initializing...',
  }

  async componentDidMount() {
    await sleep(0); // Exit the `componentDidMount` stack frame

    let connection = null;
    let errorMessage = null;
    let attempt = 0;
    while (connection === null) {
      const initMessage = `Connecting to ${url}... ` +
        (attempt === 0 ? '' : `(#${attempt}: ${errorMessage})`);
      this.setState({initMessage});
      console.log(initMessage);
      try {
        connection = new Connection(url);
        await connection.getLastId();
      } catch (err) {
        console.log(err);
        errorMessage = err.message;
        connection = null;
        await sleep(1000);
      }
      attempt++;
    }

    try {
      this.setState({initMessage: `Connecting to dashboard...`});

      // Load the dashboard account publicKey from the server, so it remains the
      // same for all users
      const url = window.location.origin + '/config.json';
      const response = await fetch(url);
      const {publicKey} = await response.json();

      this.setState({initMessage: `Loading dashboard state...`});
      const dashboard = await TicTacToeDashboard.connect(connection, new PublicKey(publicKey));

      this.setState({initialized: true, dashboard});
    } catch (err) {
      console.log(err);
      this.setState({initMessage: `Initialization failed: ${err.message}`});
    }
  }

  render() {
    if (!this.state.initialized) {
      return <Well>{this.state.initMessage}</Well>;
    }
    return <Game dashboard={this.state.dashboard}/>;
  }
}

ReactDOM.render(<App />, document.getElementById('app'));
module.hot.accept();
