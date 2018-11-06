/**
 * @brief TicTacToe Dashboard C-based BPF program
 */
#include <solana_sdk.h>

#include "program_command.h"
#include "program_state.h"

SOL_FN_PREFIX void game_dump_board(Game *self) {
  sol_log_64(0x9, 0x9, 0x9, 0x9, 0x9);
  sol_log_64(0, 0, self->board[0], self->board[1], self->board[2]);
  sol_log_64(0, 0, self->board[3], self->board[4], self->board[5]);
  sol_log_64(0, 0, self->board[6], self->board[7], self->board[8]);
  sol_log_64(0x9, 0x9, 0x9, 0x9, 0x9);
}

SOL_FN_PREFIX bool game_create(Game *self, SolPubkey *player_x) {
  // account memory is zero-initialized
  sol_memcpy(&self->player_x, player_x, sizeof(*player_x));
  return true;
}

SOL_FN_PREFIX bool game_join(
  Game *self,
  SolPubkey *player_o,
  uint64_t timestamp
) {
  if (self->game_state != GameState_Waiting) {
    sol_log_64(2, self->game_state, 0, 1, 1);
    // Result_GameInProgress;
    return false;
  }
  sol_memcpy(self->player_o.x, player_o, sizeof(*player_o));
  self->game_state = GameState_XMove;

  if (timestamp <= self->keep_alive[1]) {
    sol_log_64(2, 0, 0, 2, 1);
    // Result_InvalidTimestamp;
    return false;
  }
  sol_log_64(2, 0, 0, 3, 1);
  self->keep_alive[1] = timestamp;
  return true;
}

SOL_FN_PREFIX bool game_same(
  BoardItem x_or_o,
  BoardItem one,
  BoardItem two,
  BoardItem three
) {
  if (x_or_o == one && x_or_o == two && x_or_o == three) {
    return true;
  }
  return false;
}

SOL_FN_PREFIX bool game_same_player(SolPubkey *one, SolPubkey *two) {
  return sol_memcmp(one, two, sizeof(*one)) == 0;
}

SOL_FN_PREFIX bool game_move(
  Game *self,
  SolPubkey *player,
  int x,
  int y
) {
  int board_index = y * 3 + x;
  if (board_index >= 9 || self->board[board_index] != BoardItem_Free) {
    // Result_InvalidMove
    return false;
  }

  BoardItem x_or_o;
  GameState won_state;

  switch (self->game_state) {
  case GameState_XMove:
    if (!game_same_player(player, &self->player_x)) {
      // Result_PlayerNotFound
      return false;
    }
    self->game_state = GameState_OMove;
    x_or_o = BoardItem_X;
    won_state = GameState_XWon;
    break;

  case GameState_OMove:
    if (!game_same_player(player, &self->player_o)) {
      // Result_PlayerNotFound
      return false;
    }
    self->game_state = GameState_XMove;
    x_or_o = BoardItem_O;
    won_state = GameState_OWon;
    break;

  default:
    // Result_NotYourTurn
    return false;
  }

  self->board[board_index] = x_or_o;

  // game_dump_board(self);

  bool winner =
    // Check rows
    game_same(x_or_o, self->board[0], self->board[1], self->board[2]) ||
    game_same(x_or_o, self->board[3], self->board[4], self->board[5]) ||
    game_same(x_or_o, self->board[6], self->board[7], self->board[8]) ||
    // Check columns
    game_same(x_or_o, self->board[0], self->board[3], self->board[6]) ||
    game_same(x_or_o, self->board[1], self->board[4], self->board[7]) ||
    game_same(x_or_o, self->board[2], self->board[5], self->board[8]) ||
    // Check both diagonals
    game_same(x_or_o, self->board[0], self->board[4], self->board[8]) ||
    game_same(x_or_o, self->board[2], self->board[4], self->board[6]);

  if (winner) {
    self->game_state = won_state;
  }

  {
    int draw = true;
    for (int i = 0; i < 9; i++) {
      if (BoardItem_Free == self->board[i]) {
        draw = false;
        break;
      }
    }
    if (draw) {
      self->game_state = GameState_Draw;
    }
  }
  return true;
}

SOL_FN_PREFIX bool game_keep_alive(
  Game *self,
  SolPubkey *player,
  uint64_t timestamp
) {
  switch (self->game_state) {
    case GameState_Waiting:
    case GameState_XMove:
    case GameState_OMove:
      if (game_same_player(player, &self->player_x)) {
        if (timestamp <= self->keep_alive[0]) {
          sol_log_64(2, timestamp, self->keep_alive[0], 1, 3);
          // Result_InvalidTimestamp;
          return false;
        }
        sol_log_64(2, timestamp, 0, 2, 3);
        self->keep_alive[0] = timestamp;
        return true;
      }

      if (game_same_player(player, &self->player_o)) {
        if (timestamp <= self->keep_alive[1]) {
          sol_log_64(2, timestamp, self->keep_alive[1], 3, 3);
          // Result_InvalidTimestamp;
          return false;
        }
        sol_log_64(2, timestamp, 0, 4, 3);
        self->keep_alive[1] = timestamp;
        return true;
      }
      sol_log_64(2, 0, 0, 5, 3);
      // Result_PlayerNotFound;
      return false;

    default:
      sol_log_64(2, 0, 0, 6, 3);
      // Result_NotYourTurn
      return false;
  }
}

SOL_FN_PREFIX bool dashboard_update(
  Dashboard *self,
  SolPubkey const *game_pubkey,
  Game const *game
) {
  switch (game->game_state) {
  case GameState_Waiting:
    sol_log_64(3, 0, 0, 0, 6);
    sol_memcpy(&self->pending_game, game_pubkey, sizeof(*game_pubkey));
    break;
  case GameState_XMove:
  case GameState_OMove:
    // Nothing to do.  In progress games are not managed by the dashboard
    sol_log_64(3, 0, 0, 0, 7);
    break;
  case GameState_XWon:
  case GameState_OWon:
  case GameState_Draw:
    sol_log_64(3, 0, 0, 0, 8);
    for (int i = 0; i < MAX_COMPLETED_GAMES; i++) {
      if (SolPubkey_same(&self->completed_games[i], game_pubkey)) {
        // TODO: Once the PoH height is exposed to programs, it could be used
        // to ensure
        //       that old games are not being re-added and causing total to
        //       increment incorrectly.
        return true;
      }
    }
    self->total_games += 1;
    self->latest_completed_game_index =
      (self->latest_completed_game_index + 1) % MAX_COMPLETED_GAMES;
    sol_memcpy(
      &self->completed_games[self->latest_completed_game_index],
      game_pubkey,
      sizeof(*game_pubkey)
    );
    break;

  default:
    break;
  }
  sol_log_64(3, 0, 0, 0, 9);
  return true;
}

extern bool entrypoint(const uint8_t *input) {
  SolKeyedAccounts ka[3];
  uint64_t ka_len;
  const uint8_t *instruction_data;
  uint64_t instruction_data_len;

  if (!sol_deserialize(input, ka, SOL_ARRAY_SIZE(ka), &ka_len, &instruction_data, &instruction_data_len)) {
    sol_log_64(0, 0, 0, 0, 1);
    return false;
  }

  if (ka_len < 2) {
    sol_log_64(0, 0, 0, 0, 2);
    return false;
  }

  if (instruction_data_len < sizeof(uint32_t) + sizeof(CommandData)) {
    sol_log_64(0, 0, instruction_data_len, sizeof(uint32_t) + sizeof(CommandData), 3);
    return false;
  }
  Command const cmd = *(uint32_t *) instruction_data;
  CommandData const *cmd_data = (CommandData *) (instruction_data + sizeof(uint32_t));

  if (ka[1].userdata_len < sizeof(uint32_t) + sizeof(StateData)) {
    sol_log_64(0, cmd, ka[1].userdata_len, sizeof(uint32_t) + sizeof(StateData), 4);
    return false;
  }
  State *state = (uint32_t *) ka[1].userdata;
  StateData *state_data = (StateData *) (ka[1].userdata + sizeof(uint32_t));

  switch (*state) {
  case State_Uninitialized:
    sol_log_64(1, 0, 0, 0, 0);

    if (sol_memcmp(ka[0].key, ka[1].key, sizeof(SolPubkey)) != 0) {
      // InitGame/InitDashboard commands must be signed by the
      // state account itself
      sol_log_64(1, 0, 0, 0, 1);
      return false;
    }

    switch (cmd) {
    case Command_InitDashboard:
      sol_log_64(1, 0, 0, 0, 2);
      *state = State_Dashboard;
      return true;

    case Command_InitGame:
      if (ka_len < 3) {
        sol_log_64(1, 0, 0, 0, 3);
        return false;
      }
      sol_log_64(1, 0, 0, 0, 4);
      *state = State_Game;
      return game_create(&state_data->game, ka[2].key);

    default:
      sol_log_64(1, 0, 0, 0, 5);
      return false;
    }

  case State_Game:
    sol_log_64(2, 0, 0, 0, 0);
    SolPubkey *player = ka[0].key;
    switch (cmd) {
    case Command_Join:
      sol_log_64(2, cmd_data->join.timestamp, 0, 0, 1);
      return game_join(&state_data->game, player, cmd_data->join.timestamp);
    case Command_Move:
      sol_log_64(2, cmd_data->move.x, cmd_data->move.y, 0, 2);
      return game_move(&state_data->game, player, cmd_data->move.x, cmd_data->move.y);
    case Command_KeepAlive:
      sol_log_64(2, cmd_data->keep_alive.timestamp, 0, 0, 3);
      return game_keep_alive(&state_data->game, player, cmd_data->keep_alive.timestamp);
    default:
      sol_log_64(2, 0, 0, 0, 4);
      return false;
    }

  case State_Dashboard:
    sol_log_64(3, 0, 0, 0, 0);
    if (ka_len < 3) {
      sol_log_64(3, 0, 0, 0, 1);
      return false;
    }
    if (ka[2].userdata_len < sizeof(uint32_t) + sizeof(StateData)) {
      sol_log_64(3, 0, 0, 0, 2);
      return false;
    }
    State game_state = *(uint32_t *) ka[2].userdata;
    StateData *game_state_data = (StateData *) (ka[2].userdata + sizeof(uint32_t));

    if (cmd != Command_UpdateDashboard) {
      sol_log_64(3, 0, 0, 0, 3);
      return false;
    }

    if (game_state != State_Game) {
      sol_log_64(3, 0, 0, 0, 4);
      return false;
    }
    sol_log_64(3, 0, 0, 0, 5);
    return dashboard_update(&state_data->dashboard, ka[2].key, &game_state_data->game);

  default:
    sol_log_64(0, 0, 0, 0, 5);
    return false;
  }
}
