#include <criterion/criterion.h>
#include "../src/tictactoe.c"

static Game game = {};
static SolPubkey player_x = {.x = {1,}};
static SolPubkey player_o = {.x = {2,}};

void start_game(void) {
  cr_assert(!SolPubkey_same(&player_x, &player_o));

  sol_memset(&game, 0, sizeof(game));
  cr_assert_eq(game.game_state, GameState_Waiting);
  game_create(&game, &player_x, 0);
  cr_assert_eq(game.game_state, GameState_Waiting);
  game_join(&game, &player_o, 0);
  cr_assert_eq(game.game_state, GameState_XMove);
}

Test(game, column_1_x_wins, .init = start_game) {
  /*
      X|O|
      -+-+-
      X|O|
      -+-+-
      X| |
  */

  cr_assert(game_move(&game, &player_x, 0, 0));
  cr_assert_eq(game.game_state, GameState_OMove);
  cr_assert(game_move(&game, &player_o, 1, 0));
  cr_assert_eq(game.game_state, GameState_XMove);
  cr_assert(game_move(&game, &player_x, 0, 1));
  cr_assert_eq(game.game_state, GameState_OMove);
  cr_assert(game_move(&game, &player_o, 1, 1));
  cr_assert_eq(game.game_state, GameState_XMove);
  cr_assert(game_move(&game, &player_x, 0, 2));
  cr_assert_eq(game.game_state, GameState_XWon);
}

Test(game, right_diagonal_x_wins, .init = start_game) {
  /*
      X|O|X
      -+-+-
      O|X|O
      -+-+-
      X| |
  */

  cr_assert(game_move(&game, &player_x, 0, 0));
  cr_assert(game_move(&game, &player_o, 1, 0));
  cr_assert(game_move(&game, &player_x, 2, 0));
  cr_assert(game_move(&game, &player_o, 0, 1));
  cr_assert(game_move(&game, &player_x, 1, 1));
  cr_assert(game_move(&game, &player_o, 2, 1));
  cr_assert(game_move(&game, &player_x, 0, 2));
  cr_assert_eq(game.game_state, GameState_XWon);

  cr_assert(!game_move(&game, &player_o, 1, 2));
}

Test(game, bottom_row_o_wins, .init = start_game) {
  /*
      X|X|
      -+-+-
      X| |
      -+-+-
      O|O|O
  */

  cr_assert(game_move(&game, &player_x, 0, 0));
  cr_assert(game_move(&game, &player_o, 0, 2));
  cr_assert(game_move(&game, &player_x, 1, 0));
  cr_assert(game_move(&game, &player_o, 1, 2));
  cr_assert(game_move(&game, &player_x, 0, 1));
  cr_assert(game_move(&game, &player_o, 2, 2));
  cr_assert_eq(game.game_state, GameState_OWon);

  cr_assert(!game_move(&game, &player_x, 1, 2));
}

Test(game, left_diagonal_x_wins, .init = start_game) {
  /*
      X|O|X
      -+-+-
      O|X|O
      -+-+-
      O|X|X
  */

  cr_assert(game_move(&game, &player_x, 0, 0));
  cr_assert(game_move(&game, &player_o, 1, 0));
  cr_assert(game_move(&game, &player_x, 2, 0));
  cr_assert(game_move(&game, &player_o, 0, 1));
  cr_assert(game_move(&game, &player_x, 1, 1));
  cr_assert(game_move(&game, &player_o, 2, 1));
  cr_assert(game_move(&game, &player_x, 1, 2));
  cr_assert(game_move(&game, &player_o, 0, 2));
  cr_assert(game_move(&game, &player_x, 2, 2));
  cr_assert_eq(game.game_state, GameState_XWon);
}

Test(game, draw, .init = start_game) {
  /*
      X|O|O
      -+-+-
      O|O|X
      -+-+-
      X|X|O
  */

  cr_assert(game_move(&game, &player_x, 0, 0));
  cr_assert(game_move(&game, &player_o, 1, 1));
  cr_assert(game_move(&game, &player_x, 0, 2));
  cr_assert(game_move(&game, &player_o, 0, 1));
  cr_assert(game_move(&game, &player_x, 2, 1));
  cr_assert(game_move(&game, &player_o, 1, 0));
  cr_assert(game_move(&game, &player_x, 1, 2));
  cr_assert(game_move(&game, &player_o, 2, 2));
  cr_assert(game_move(&game, &player_x, 2, 0));

  cr_assert_eq(game.game_state, GameState_Draw);
}

Test(game, solo_game) {
  /*
      X|O|
      -+-+-
       | |
      -+-+-
       | |
  */

  sol_memset(&game, 0, sizeof(game));
  cr_assert_eq(game.game_state, GameState_Waiting);
  game_create(&game, &player_x, 0);
  cr_assert_eq(game.game_state, GameState_Waiting);
  game_join(&game, &player_x, 0);

  cr_assert_eq(game.game_state, GameState_XMove);
  cr_assert(game_move(&game, &player_x, 0, 0));
  cr_assert_eq(game.game_state, GameState_OMove);
  cr_assert(game_move(&game, &player_x, 1, 0));
  cr_assert_eq(game.game_state, GameState_XMove);
}
