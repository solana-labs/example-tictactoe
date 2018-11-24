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

SOL_FN_PREFIX bool game_create(Game *self, SolPubkey *player_x, uint64_t tick_height) {
  // account memory is zero-initialized
  sol_memcpy(&self->player_x, player_x, sizeof(*player_x));
  self->keep_alive[0] = tick_height;
  return true;
}

SOL_FN_PREFIX bool game_join(
  Game *self,
  SolPubkey *player_o,
  uint64_t tick_height
) {
  if (self->game_state != GameState_Waiting) {
    sol_log("Unable to join, game is not in the waiting state");
    sol_log_64(2, self->game_state, 0, 1, 1);
    return false;
  }
  sol_memcpy(self->player_o.x, player_o, sizeof(*player_o));
  self->game_state = GameState_XMove;

  sol_log("Game joined");
  self->keep_alive[1] = tick_height;
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
    sol_log("Invalid move");
    return false;
  }

  BoardItem x_or_o;
  GameState won_state;

  switch (self->game_state) {
  case GameState_XMove:
    if (!game_same_player(player, &self->player_x)) {
      sol_log("Invalid player for x move");
      return false;
    }
    self->game_state = GameState_OMove;
    x_or_o = BoardItem_X;
    won_state = GameState_XWon;
    break;

  case GameState_OMove:
    if (!game_same_player(player, &self->player_o)) {
      sol_log("Invalid player for o move");
      return false;
    }
    self->game_state = GameState_XMove;
    x_or_o = BoardItem_O;
    won_state = GameState_OWon;
    break;

  default:
    sol_log("Game is not in progress");
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
  } else {
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
  uint64_t tick_height
) {
  switch (self->game_state) {
    case GameState_Waiting:
    case GameState_XMove:
    case GameState_OMove:
      if (game_same_player(player, &self->player_x)) {
        if (tick_height <= self->keep_alive[0]) {
          sol_log("Invalid player x keep_alive");
          sol_log_64(2, tick_height, self->keep_alive[0], 1, 3);
          // Result_InvalidTimestamp;
          return false;
        }
        sol_log("Player x keep_alive");
        sol_log_64(2, tick_height, 0, 2, 3);
        self->keep_alive[0] = tick_height;
        return true;
      }

      if (game_same_player(player, &self->player_o)) {
        if (tick_height <= self->keep_alive[1]) {
          sol_log("Invalid player o keep_alive");
          sol_log_64(2, tick_height, self->keep_alive[1], 3, 3);
          // Result_InvalidTimestamp;
          return false;
        }
        sol_log("Player y keep_alive");
        sol_log_64(2, tick_height, 0, 4, 3);
        self->keep_alive[1] = tick_height;
        return true;
      }
      sol_log("Unknown player");
      // Result_PlayerNotFound;
      return false;

    default:
      sol_log("Invalid game state");
      // Result_NotYourTurn
      return false;
  }
}

SOL_FN_PREFIX bool dashboard_update(
  Dashboard *self,
  SolPubkey const *game_pubkey,
  Game const *game,
  uint64_t tick_height
) {
  switch (game->game_state) {
  case GameState_Waiting:
    sol_log("Replacing dashboard pending game");
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
    sol_log("Adding new completed game");
    for (int i = 0; i < MAX_COMPLETED_GAMES; i++) {
      if (SolPubkey_same(&self->completed_games[i], game_pubkey)) {
        return true;
      }
    }

    // NOTE: tick_height could be used here to ensure that old games are not
    // being re-added and causing total to increment incorrectly.
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
  return true;
}

extern bool entrypoint(const uint8_t *input) {
  SolKeyedAccounts ka[3];
  uint64_t ka_len;
  const uint8_t *instruction_data;
  uint64_t instruction_data_len;
  SolClusterInfo info;

  sol_log("tic-tac-toe program entrypoint");

  if (!sol_deserialize(input, ka, SOL_ARRAY_SIZE(ka), &ka_len, &instruction_data, &instruction_data_len, &info)) {
    sol_log("Error: deserialize failed");
    return false;
  }

  if (ka_len < 2) {
    sol_log("Error: two keys required");
    return false;
  }

  if (instruction_data_len < sizeof(uint32_t) + sizeof(CommandData)) {
    sol_log("Error: invalid instruction_data_len");
    sol_log_64(0, 0, instruction_data_len, sizeof(uint32_t) + sizeof(CommandData), 3);
    return false;
  }
  Command const cmd = *(uint32_t *) instruction_data;
  CommandData const *cmd_data = (CommandData *) (instruction_data + sizeof(uint32_t));

  if (ka[1].userdata_len < sizeof(uint32_t) + sizeof(StateData)) {
    sol_log("Error: invalid userdata_len");
    sol_log_64(0, cmd, ka[1].userdata_len, sizeof(uint32_t) + sizeof(StateData), 4);
    return false;
  }
  State *state = (uint32_t *) ka[1].userdata;
  StateData *state_data = (StateData *) (ka[1].userdata + sizeof(uint32_t));

  switch (*state) {
  case State_Uninitialized:
    sol_log("Account is uninitialized");

    if (sol_memcmp(ka[0].key, ka[1].key, sizeof(SolPubkey)) != 0) {
      // InitGame/InitDashboard commands must be signed by the
      // state account itself
      sol_log("Account not self signed");
      return false;
    }

    switch (cmd) {
    case Command_InitDashboard:
      sol_log("Command_InitDashboard");
      *state = State_Dashboard;
      return true;

    case Command_InitGame:
      sol_log("Command_InitGame");
      if (ka_len < 3) {
        sol_log("Error: 3 keys required");
        return false;
      }
      *state = State_Game;
      return game_create(&state_data->game, ka[2].key, info.tick_height);

    default:
      sol_log("Error: Invalid command");
      return false;
    }

  case State_Game:
    sol_log("Account is a game");

    SolPubkey *player = ka[0].key;
    switch (cmd) {
    case Command_Join:
      sol_log("Command_Join");
      return game_join(&state_data->game, player, info.tick_height);
    case Command_Move:
      sol_log("Command_Move");
      sol_log_64(2, cmd_data->move.x, cmd_data->move.y, 0, 2);
      return game_move(&state_data->game, player, cmd_data->move.x, cmd_data->move.y);
    case Command_KeepAlive:
      sol_log("Command_KeepAlive");
      return game_keep_alive(&state_data->game, player, info.tick_height);
    default:
      sol_log("Error: Invalid command");
      return false;
    }

  case State_Dashboard:
    sol_log("Account is a dashboard");

    if (ka_len < 3) {
      sol_log("Error: 3 keys required");
      return false;
    }
    if (ka[2].userdata_len < sizeof(uint32_t) + sizeof(StateData)) {
      sol_log("Error: invalid userdata_len");
      return false;
    }
    State game_state = *(uint32_t *) ka[2].userdata;
    StateData *game_state_data = (StateData *) (ka[2].userdata + sizeof(uint32_t));

    if (cmd != Command_UpdateDashboard) {
      sol_log("Error: Invalid command");
      return false;
    }
    if (game_state != State_Game) {
      sol_log("Error: 3rd key is not a game account");
      return false;
    }
    if (sol_memcmp(ka[1].program_id, ka[2].program_id, sizeof(*ka[1].program_id))) {
      sol_log("Error: incompatible game account");
      return false;
    }

    sol_log("Command_UpdateDashboard");
    return dashboard_update(
      &state_data->dashboard,
      ka[2].key,
      &game_state_data->game,
      info.tick_height
    );

  default:
    sol_log("Error: Invalid account state");
    return false;
  }
}
