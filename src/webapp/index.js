import React from 'react';
import ReactDOM from 'react-dom';

class App extends React.Component {
  state = {
    initialized: false,
  }

  async componentDidMount() {
    await this.state.store.init();
    this.setState({initialized: true});
  }

  render() {
    if (!this.state.initialized) {
      return <div />; // TODO: Loading screen?
    }
    return <div>TODO</div>;
  }
}

ReactDOM.render(<App />, document.getElementById('app'));
module.hot.accept();
