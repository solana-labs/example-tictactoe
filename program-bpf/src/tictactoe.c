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

SOL_FN_PREFIX void game_create(Game *self, SolPubkey *player_x, uint64_t tick_height) {
  // account memory is zero-initialized
  sol_memcpy(&self->player_x, player_x, sizeof(*player_x));
  self->keep_alive[0] = tick_height;
}

SOL_FN_PREFIX void game_join(
  Game *self,
  SolPubkey *player_o,
  uint64_t tick_height
) {
  if (self->game_state != GameState_Waiting) {
    sol_log("Unable to join, game is not in the waiting state");
    sol_log_64(self->game_state, 0, 0, 0, 0);
  } else {
    sol_memcpy(self->player_o.x, player_o, sizeof(*player_o));
    self->game_state = GameState_XMove;

    sol_log("Game joined");
    self->keep_alive[1] = tick_height;
  }
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
          sol_log_64(tick_height, self->keep_alive[0], 0, 0, 0);
          return false;
        }
        sol_log("Player x keep_alive");
        sol_log_64(tick_height, 0, 0, 0, 0);
        self->keep_alive[0] = tick_height;
      } else if (game_same_player(player, &self->player_o)) {
        if (tick_height <= self->keep_alive[1]) {
          sol_log("Invalid player o keep_alive");
          sol_log_64(tick_height, self->keep_alive[1], 0, 0, 0);
          return false;
        }
        sol_log("Player y keep_alive");
        sol_log_64(tick_height, 0, 0, 0, 0);
        self->keep_alive[1] = tick_height;
      } else {
        sol_log("Unknown player");
        return false;
      }
      break;

    default:
      sol_log("Invalid game state");
      return false;
  }
  return true;
}

SOL_FN_PREFIX void dashboard_update(
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
    // Nothing to do
    break;
  case GameState_XWon:
  case GameState_OWon:
  case GameState_Draw:
    for (int i = 0; i < MAX_COMPLETED_GAMES; i++) {
      if (SolPubkey_same(&self->completed_games[i], game_pubkey)) {
        sol_log("Ignoring known completed game");
        return;
      }
    }
    sol_log("Adding new completed game");

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
}

SOL_FN_PREFIX bool fund_next_move(SolKeyedAccount *dashboard_ka, SolKeyedAccount *ka) {
  sol_log("fund_next_move");
  sol_log_64(*(dashboard_ka->tokens), *(ka->tokens), 0, 0, 0);
  if (*ka->tokens != 0) {
    sol_log("Player still has tokens");
  } else if (*dashboard_ka->tokens <= 1) {
    sol_log("Dashboard is out of tokens");
    return false;
  } else {
    *(ka->tokens) += 1;
    *(dashboard_ka->tokens) -= 1;
    sol_log_64(*(dashboard_ka->tokens), *(ka->tokens), 0, 0, 0);
  }
  return true;
}

extern bool entrypoint(const uint8_t *input) {
  SolKeyedAccount ka[3];
  uint64_t ka_len;
  const uint8_t *instruction_data;
  uint64_t instruction_data_len;
  SolClusterInfo info;

  sol_log("tic-tac-toe program entrypoint");

  if (!sol_deserialize(input, ka, SOL_ARRAY_SIZE(ka), &ka_len, &instruction_data, &instruction_data_len, &info)) {
    sol_log("Error: deserialize failed");
    return false;
  }

  if (!ka[0].is_signer) {
    sol_log("Transaction not signed by key 0");
    return false;
  }

  if (instruction_data_len < sizeof(uint32_t) + sizeof(CommandData)) {
    sol_log("Error: invalid instruction_data_len");
    sol_log_64(instruction_data_len, sizeof(uint32_t) + sizeof(CommandData), 0, 0, 0);
    return false;
  }
  Command const cmd = *(uint32_t *) instruction_data;
  CommandData const *cmd_data = (CommandData *) (instruction_data + sizeof(uint32_t));
  sol_log_64(cmd, 0, 0, 0, 0);

  State *dashboard_state = NULL;
  StateData *dashboard_state_data = NULL;

  if (cmd == Command_InitDashboard) {
    sol_log("Command_InitDashboard");
    if (ka_len != 1) {
      sol_log("Error: one key expected");
      return false;
    }

    if (!state_deserialize(&ka[0], &dashboard_state, &dashboard_state_data)) {
      return false;
    }

    if (*dashboard_state != State_Uninitialized) {
      sol_log("Dashboard is already uninitialized");
      return false;
    }

    *dashboard_state = State_Dashboard;
    return true;
  }

  if (cmd == Command_InitPlayer) {
    sol_log("Command_InitPlayer");
    if (ka_len != 2) {
      sol_log("Error: two keys expected");
      return false;
    }

    if (!state_deserialize(&ka[0], &dashboard_state, &dashboard_state_data)) {
      return false;
    }

    if (*dashboard_state != State_Dashboard) {
      sol_log("Invalid dashboard account");
      return false;
    }

    if (!SolPubkey_same(ka[0].owner, ka[1].owner) || ka[1].userdata_len != 0) {
      sol_log("Invalid player account");
      return false;
    }
    // Distribute funds to the player for their next transaction
    return fund_next_move(&ka[0], &ka[1]);
  }
  if (ka_len != 3) {
    sol_log("Error: three keys expected");
    return false;
  }

  if (!state_deserialize(&ka[1], &dashboard_state, &dashboard_state_data)) {
    sol_log("dashboard deserialize failed");
    return false;
  }

  if (*dashboard_state != State_Dashboard) {
    sol_log("Invalid dashboard account");
    return false;
  }

  State *game_state = NULL;
  StateData *game_state_data = NULL;

  if (cmd == Command_InitGame) {
    sol_log("Command_InitGame");
    if (!state_deserialize(&ka[0], &game_state, &game_state_data)) {
      return false;
    }

    if (*game_state != State_Uninitialized) {
      sol_log("Account is already uninitialized");
      return false;
    }

    if (!SolPubkey_same(ka[0].owner, ka[2].owner) || ka[2].userdata_len != 0) {
      sol_log("Invalid player account");
      return false;
    }

    *game_state = State_Game;
    SolPubkey *player_x = ka[2].key;
    game_create(&game_state_data->game, player_x, info.tick_height);

    dashboard_update(
      &dashboard_state_data->dashboard,
      ka[0].key,
      &game_state_data->game,
      info.tick_height
    );

    // Distribute funds to the player for their next transaction, and to the
    // game account to keep it's state loaded
    return fund_next_move(&ka[1], &ka[0]) && fund_next_move(&ka[1], &ka[2]);
  }

  if (!state_deserialize(&ka[2], &game_state, &game_state_data)) {
    sol_log("game deserialize failed");
    return false;
  }

  if (*game_state != State_Game) {
    sol_log("Invalid game account");
    return false;
  }

  if (!SolPubkey_same(ka[0].owner, ka[1].owner) || ka[0].userdata_len != 0) {
    sol_log("Invalid player account");
    return false;
  }

  SolPubkey *player = ka[0].key;
  switch (cmd) {
  case Command_Advertise:
    sol_log("Command_Advertise");
    // Nothing to do here beyond the dashboard_update() below
    break;
  case Command_Join:
    sol_log("Command_Join");
    game_join(&game_state_data->game, player, info.tick_height);
    break;
  case Command_Move:
    sol_log("Command_Move");
    sol_log_64(cmd_data->move.x, cmd_data->move.y, 0, 0, 0);
    if (!game_move(&game_state_data->game, player, cmd_data->move.x, cmd_data->move.y)) {
      return false;
    }
    break;
  case Command_KeepAlive:
    sol_log("Command_KeepAlive");
    if (!game_keep_alive(&game_state_data->game, player, info.tick_height)) {
      return false;
    }
    break;
  default:
    sol_log("Error: Invalid command");
    return false;
  }

  dashboard_update(
    &dashboard_state_data->dashboard,
    ka[2].key,
    &game_state_data->game,
    info.tick_height
  );

  // Distribute funds to the player for their next transaction
  return fund_next_move(&ka[1], &ka[0]);
}
