#pragma once

typedef enum {
  /* Dashboard account commands */
  Command_InitDashboard = 0, /* Initialize a dashboard account */
  Command_UpdateDashboard,   /* Update the dashboard with the provided game account */

  /* Game account commands */
  Command_InitGame,          /* Initialize a game account */
  Command_Join,              /* Player O wants to join (seconds since UNIX epoch) */
  Command_KeepAlive,         /* Player X/O keep alive (seconds since UNIX epoch) */
  Command_Move,              /* Player X/O mark board position (x, y) */
} Command;

typedef union {
  struct {
    uint64_t timestamp;
  } join;
  struct {
    uint64_t timestamp;
  } keep_alive;
  struct {
    uint8_t x;
    uint8_t y;
  } move;
} CommandData;
