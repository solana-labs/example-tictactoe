/**
 * Functions to deserialize TicTacToe Game and Dashboard account data
 *
 * @flow
 */

import * as BufferLayout from 'buffer-layout';
import {PublicKey} from '@solana/web3.js';
import type {AccountInfo} from '@solana/web3.js';

const emptyKey = new PublicKey('0x0');

const publicKeyLayout = (property: string = 'publicKey'): Object => {
  return BufferLayout.blob(32, property);
};

export type DashboardState = {
  pendingGame: PublicKey | null,
  completedGames: Array<PublicKey>,
  totalGames: number,
};

export type Board = Array<' ' | 'X' | 'O'>;

export type GameState = {
  playerX: PublicKey | null,
  playerO: PublicKey | null,
  gameState: 'Waiting' | 'XMove' | 'OMove' | 'Draw' | 'XWon' | 'OWon',
  board: Board,
  keepAlive: [number, number],
};

export function deserializeGameState(accountInfo: AccountInfo): GameState {
  const gameLayout = BufferLayout.struct([
    BufferLayout.nu64('stateType'),
    BufferLayout.seq(BufferLayout.nu64(), 2, 'keepAlive'),
    BufferLayout.u8('gameState'),
    publicKeyLayout('playerX'),
    publicKeyLayout('playerO'),
    BufferLayout.seq(BufferLayout.u8(), 9, 'board'),
  ]);
  const game = gameLayout.decode(accountInfo.data);
  if (game.stateType != 2 /* StateType_Game */) {
    throw new Error(`Invalid game stateType: ${game.stateType}`);
  }

  const gameStates = ['Waiting', 'XMove', 'OMove', 'XWon', 'OWon', 'Draw'];
  if (game.gameState >= gameStates.length) {
    throw new Error(`Invalid game state: ${game.gameState}`);
  }

  const boardItemMap = [' ', 'X', 'O'];
  return {
    gameState: gameStates[game.gameState],
    playerX: new PublicKey(game.playerX),
    playerO: new PublicKey(game.playerO),
    board: game.board.map(item => boardItemMap[item]),
    keepAlive: game.keepAlive,
  };
}

export function deserializeDashboardState(
  accountInfo: AccountInfo,
): DashboardState {
  const dashboardLayout = BufferLayout.struct([
    BufferLayout.nu64('stateType'),
    BufferLayout.nu64('totalGames'),
    publicKeyLayout('pendingGame'),
    BufferLayout.seq(
      publicKeyLayout(),
      5 /*MAX_COMPLETED_GAMES*/,
      'completedGames',
    ),
    BufferLayout.u8('lastGameIndex'),
  ]);

  const dashboard = dashboardLayout.decode(accountInfo.data);
  if (dashboard.stateType != 1 /* StateType_Dashboard */) {
    throw new Error(`Invalid dashboard stateType: ${dashboard.stateType}`);
  }

  let completedGames = [];
  for (let i = dashboard.lastGameIndex; i >= 0; i--) {
    completedGames.unshift(dashboard.completedGames[i]);
  }
  for (
    let i = dashboard.completedGames.length;
    i > dashboard.lastGameIndex;
    i--
  ) {
    completedGames.unshift(dashboard.completedGames[i]);
  }

  const pending = new PublicKey(dashboard.pendingGame);
  return {
    pendingGame: pending.equals(emptyKey) ? null : pending,
    completedGames: completedGames
      .map(a => new PublicKey(a))
      .filter(a => !a.equals(emptyKey)),
    totalGames: dashboard.totalGames,
  };
}
