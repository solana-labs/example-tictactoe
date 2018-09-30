import moment from 'moment';
import React from 'react';
import {
  Button,
  Carousel,
  Panel,
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
    clearTimeout(this.refreshGameTimeout);
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
          this.refreshDashboard();
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

      if (currentGame.state.myTurn) {
        return; // Suspend refreshGame() until the local player makes a move
      }
    }
    this.refreshGameTimeout = setTimeout(::this.refreshGame, 500);
  }

  async refreshDashboard() {
    clearTimeout(this.refreshDashboardTimeout);
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

    this.refreshDashboardTimeout = setTimeout(::this.refreshDashboard, 5000);
  }

  async handleClick(i: number) {
    const x = Math.floor(i % 3);
    const y = Math.floor(i / 3);
    console.log('Move', x, y);

    const {
      currentGame,
    } = this.state;
    try {
      // Update the UI immediately with the move for better user feedback, but
      // also send the move to the on-chain program for a final decision
      currentGame.state.board[i] = currentGame.isX ? 'X' : 'O';
      this.setState({currentGame});
      await currentGame.move(x, y);
    } catch (err) {
      console.log(`Unable to move to ${x}x${y}: ${err.message}`);
    }

    // Resume polling for remote activity
    this.refreshGame();
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
          <Carousel pauseOnHover={false} interval={3000} indicators={false}>
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
                    <p><i>{lastMove.getSeconds() === 0 ? '' : moment(lastMove).fromNow()}</i></p>
                    <Board
                      disabled="true"
                      bsSize="xsmall"
                      squares={game.board}
                      onClick={() => undefined}
                    />
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
            Play again
          </Button>
        </div>
      );
    }

    return (
      <div>
        <Panel>
          <Panel.Heading>
            <Panel.Title>Current Game</Panel.Title>
          </Panel.Heading>
          <Panel.Body>
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
          </Panel.Body>
        </Panel>
        {gameHistory}
      </div>
    );
  }
}
Game.propTypes = {
  dashboard: PropTypes.object, // TicTacToeDashboard
};

