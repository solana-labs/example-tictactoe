/**
 * Transactions sent to the tic-tac-toe program contain commands that are
 * defined in this file:
 * - keys will vary by the specified Command
 * - userdata is a Command enum (as a 32 bit value) followed by a CommandData union.
 */
#pragma once

typedef enum {
  /* Dashboard account commands */

  /*
   * Initialize a dashboard account
   *
   * key[0] - dashboard account
   * key[1] - dashboard account (duplication is for implementation convenience)
   *
   * CommandData: none
   */
  Command_InitDashboard = 0,

  /*
   * Update the dashboard with the provided game account
   *
   * key[0] - anybody.
   * key[1] - dashboard account
   * key[2] - game account to update the dashboard from
   *
   * CommandData: none
   */
  Command_UpdateDashboard,

  /* Game account commands*/

  /*
   * Initialize a game account
   *
   * key[0] - game account
   * key[1] - game account (duplication is for implementation convenience)
   *
   * CommandData: none
   */
  Command_InitGame,

  /*
   * Player O wants to join
   *
   * key[0] - player O
   * key[1] - game account
   *
   * CommandData: none
   */
  Command_Join,

  /*
   * Player X/O keep alive
   *
   * key[0] - player X or O
   * key[1] - game account
   *
   * CommandData: none
   */
  Command_KeepAlive,

  /*
   * Player X/O mark board position (x, y)
   *
   * key[0] - player X or O
   * key[1] - game account
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
