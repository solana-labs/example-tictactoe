import React from 'react';
import ReactDOM from 'react-dom';
import {
  Well,
} from 'react-bootstrap';
import {Connection} from '@solana/web3.js';

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
    try {
      await sleep(0); // Exit the `componentDidMount` stack frame

      this.setState({initMessage: `Connecting to ${url}...`});
      const connection = new Connection(url);
      await connection.getLastId();

      this.setState({initMessage: `Loading game state...`});
      const dashboard = await TicTacToeDashboard.connect(connection);

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
