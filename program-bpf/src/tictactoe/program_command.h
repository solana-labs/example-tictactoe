/**
 * Transactions sent to the tic-tac-toe program contain commands that are
 * defined in this file:
 * - keys will vary by the specified Command
 * - userdata is a Command enum (as a 32 bit value) followed by a CommandData union.
 */
#pragma once

typedef enum {
  /*
   * Initialize a dashboard account
   *
   * key[0] - dashboard account
   *
   * CommandData: none
   */
  Command_InitDashboard = 0,

  /*
   * Initialize a player account
   *
   * key[0] - dashboard account
   * key[1] - player account
   *
   * CommandData: none
   */
  Command_InitPlayer,

  /*
   * Initialize a game account
   *
   * key[0] - game account
   * key[1] - dashboard account
   * key[2] - player X
   *
   * CommandData: none
   */
  Command_InitGame,

  /*
   * Used by Player X to advertise their game
   *
   * key[0] - player X
   * key[1] - dashboard account
   * key[2] - game account
   *
   * CommandData: none
   */
  Command_Advertise,

  /*
   * Player O wants to join
   *
   * key[0] - player O
   * key[1] - dashboard account
   * key[2] - game account
   *
   * CommandData: none
   */
  Command_Join,

  /*
   * Player X/O keep alive
   *
   * key[0] - player X or O
   * key[1] - dashboard account
   * key[2] - game account
   *
   * CommandData: none
   */
  Command_KeepAlive,

  /*
   * Player X/O mark board position (x, y)
   *
   * key[0] - player X or O
   * key[1] - dashboard account
   * key[2] - game account
   *
   * CommandData: move
   */
  Command_Move,
} Command;

typedef union {
  struct {
    uint8_t x;
    uint8_t y;
  } move;
} CommandData;
