import React from 'react';
import {
  Button,
  Carousel,
  Panel,
  Well,
} from 'react-bootstrap';
import PropTypes from 'prop-types';

import {TicTacToe} from '../program/tic-tac-toe';
import {Board} from './Board';

export class Game extends React.Component {
  constructor(props) {
    super(props);
    this.stopRefresh = false;
    this.recentGameState = {};
    this.dashboardNotifiedOfCompletedGame = false;
    this.state = {
      totalGames: 0,
      completedGames: [],

      currentGame: null,
      currentGameStatusMessage: '',
    };
  }

  componentDidMount() {
    this.stopRefresh = false;
    setTimeout(() => {
      this.refreshDashboard();
      this.refreshGame();
    });
  }

  componentWillUnmount() {
    this.stopRefresh = true;
  }

  async refreshGame() {
    if (this.stopRefresh) {
      return;
    }
    const {dashboard} = this.props;
    let {currentGame} = this.state;

    console.log('refreshGame...');

    if (currentGame === null) {
      try {
        this.setState({
          currentGameStatusMessage: 'Waiting for another player to join...',
        });
        currentGame = await dashboard.startGame();
        this.setState({
          currentGameStatusMessage: 'Game has started',
        });
        this.dashboardNotifiedOfCompletedGame = false;
      } catch(err) {
        console.log('Unable to start game:', err);
        this.setState({
          currentGameStatusMessage: `Unable to start game: ${err.message}`,
        });
      }
    } else {
      await currentGame.updateGameState();
    }

    if (currentGame !== null) {
      let currentGameStatusMessage;

      if (currentGame.state.inProgress) {
        if (currentGame.state.myTurn) {
          currentGameStatusMessage = `You are ${currentGame.isX ? 'X' : 'O'}, make your move`;
        } else {
          currentGameStatusMessage = 'Waiting for opponent to move...';
        }
      } else {
        // Notify the dashboard that the game has completed.
        if (!this.dashboardNotifiedOfCompletedGame) {
          this.dashboardNotifiedOfCompletedGame = true;
          await dashboard.submitGameState(currentGame.gamePublicKey);
        }

        currentGameStatusMessage = 'Game Over.  ';
        if (currentGame.abandoned) {
          currentGameStatusMessage += 'Opponent abandoned the game.';
        } else if (currentGame.state.winner) {
          currentGameStatusMessage += 'You won!';
        } else if (currentGame.state.draw) {
          currentGameStatusMessage += 'Draw.';
        } else {
          currentGameStatusMessage += 'You lost.';
        }
      }

      this.setState({
        currentGame,
        currentGameStatusMessage,
      });
    }
    setTimeout(::this.refreshGame, 500);
  }

  async refreshDashboard() {
    if (this.stopRefresh) {
      return;
    }
    const {dashboard} = this.props;
    await dashboard.update();

    for (const [, gamePublicKey] of dashboard.state.completed.entries()) {
      if (!(gamePublicKey in this.recentGameState)) {
        this.recentGameState[gamePublicKey] = await TicTacToe.getGameState(dashboard.connection, gamePublicKey);
      }
    }

    this.setState({
      totalGames: dashboard.state.total,
      completedGames: dashboard.state.completed.map((key) => this.recentGameState[key]),
    });

    setTimeout(::this.refreshDashboard, 5000);
  }

  async handleClick(i) {
    const x = Math.floor(i % 3);
    const y = Math.floor(i / 3);
    console.log('Move', x, y);

    const {
      currentGame,
    } = this.state;
    try {
      await currentGame.move(x, y);
    } catch (err) {
      console.log(`Unable to move to ${x}x${y}: ${err.message}`);
    }
  }

  render() {
    const {
      completedGames,
      currentGame,
      currentGameStatusMessage,
      totalGames,
    } = this.state;

    const gameHistory = completedGames.length === 0 ? <i>None</i> : (
      <Panel>
        <Panel.Heading>
          <Panel.Title>Total Games Played: {totalGames}</Panel.Title>
        </Panel.Heading>
        <Panel.Body>
          <Carousel indicators={false} controls={false} interval={2000}>
            {
              completedGames.map((game, i) => {
                let {gameState} = game;
                switch (game.gameState) {
                case 'OWon':
                  gameState = 'O Won';
                  break;
                case 'XWon':
                  gameState = 'X Won';
                  break;
                default:
                  break;
                }
                const lastMove = new Date(Math.max(...game.keep_alive));
                return <Carousel.Item key={i}>
                  <div align="center">
                    <h3>{gameState}</h3>
                    <br/>
                    <Board
                      bsSize="xsmall"
                      squares={game.board}
                      onClick={() => undefined}
                    />
                    <br/>
                    {lastMove.toLocaleString()}
                  </div>
                </Carousel.Item>;
              })
            }
          </Carousel>
        </Panel.Body>
      </Panel>
    );

    let playAgain = null;
    if (currentGame && !currentGame.state.inProgress) {
      playAgain = (
        <div>
          <br/>
          <Button
            block
            bsStyle="primary"
            onClick={
              () => {
                currentGame.abandon();
                this.setState({currentGame: null, currentGameStatusMessage:''});
              }
            }
          >
            Play again...
          </Button>
        </div>
      );
    }

    return (
      <div>
        <Well>
          <div align="center">
            <h2>{currentGameStatusMessage}</h2>
            <Board
              disabled={!(currentGame && currentGame.state.myTurn)}
              bsSize="large"
              squares={currentGame ? currentGame.state.board : Array(9).fill(' ')}
              onClick={i => this.handleClick(i)}
            />
            <br/>
          </div>
          {playAgain}
        </Well>
        {gameHistory}
      </div>
    );
  }
}
Game.propTypes = {
  dashboard: PropTypes.object, // TicTacToeDashboard
};

