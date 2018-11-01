#pragma once
#include <solana_sdk.h>

typedef enum {
  GameState_Waiting = 0,
  GameState_XMove,
  GameState_OMove,
  GameState_XWon,
  GameState_OWon,
  GameState_Draw,
} GameState;

typedef enum {
  BoardItem_Free = 0,
  BoardItem_X,
  BoardItem_O,
} BoardItem;

/**
 * Game program account userdata format
 *
 * Board Coordinates
 * | 0,0 | 1,0 | 2,0 |
 * | 0,1 | 1,1 | 2,1 |
 * | 0,2 | 1,2 | 2,2 |
 */
typedef struct {
  uint64_t keep_alive[2];  /* Keep alive timestamp for each player */
  uint32_t game_state;     /* Current state of the game (GameState) */
  SolPubkey player_x;      /* Player who initialized the game */
  SolPubkey player_o;      /* Player who joined the game */
  uint8_t board[9];        /* Tracks the player moves (BoardItem) */
} Game;


/**
 * Dashboard program account userdata format
 */
#define MAX_COMPLETED_GAMES 5
typedef struct {
  uint64_t total_games;                           /* Total number of completed games */
  SolPubkey pending_game;                         /* Latest pending game */
  SolPubkey completed_games[MAX_COMPLETED_GAMES]; /* Last N completed games */
  uint8_t latest_completed_game_index;            /* Index of the latest completed game */
} Dashboard;


/**
 * A tic-tac-toe account userdata contains a State enum, as a 32 bit value, followed by a StateData union
 */
typedef enum {
  State_Uninitialized = 0, /* State is not initialized yet */
  State_Dashboard,         /* State holds dashboard state */
  State_Game,              /* State holds game state */
} State;

typedef union {
  Game game;
  Dashboard dashboard;
} StateData;
