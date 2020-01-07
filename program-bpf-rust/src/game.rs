use crate::result::{ProgramError, Result};
use solana_sdk::{info, pubkey::Pubkey};

const BOARD_ITEM_FREE: u8 = 0; // Free slot
const BOARD_ITEM_X: u8 = 1; // Player X
const BOARD_ITEM_O: u8 = 2; // Player O

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
pub enum GameState {
    Waiting,
    XMove,
    OMove,
    XWon,
    OWon,
    Draw,
}
impl Default for GameState {
    fn default() -> GameState {
        GameState::Waiting
    }
}

#[repr(C)]
#[derive(Debug, Default, Clone, Serialize, Deserialize, PartialEq)]
pub struct Game {
    /// Keep alive timestamp for each player
    keep_alive: [u64; 2],
    /// Current state of the game
    pub game_state: GameState,
    /// Player who initialized the game
    player_x: Pubkey,
    /// Player who joined the game
    player_o: Pubkey,
    /// Tracks the player moves (BOARD_ITEM_xyz)
    board: [u8; 9],
}

impl Game {
    pub fn create(player_x: &Pubkey) -> Game {
        let mut game = Game::default();
        game.player_x = *player_x;
        assert_eq!(game.game_state, GameState::Waiting);
        game
    }

    #[cfg(test)]
    pub fn new(player_x: Pubkey, player_o: Pubkey) -> Game {
        let mut game = Game::create(&player_x);
        game.join(player_o, 1).unwrap();
        game
    }

    pub fn join(self: &mut Game, player_o: Pubkey, timestamp: u64) -> Result<()> {
        if self.game_state == GameState::Waiting {
            self.player_o = player_o;
            self.game_state = GameState::XMove;

            if timestamp <= self.keep_alive[1] {
                Err(ProgramError::InvalidTimestamp)
            } else {
                self.keep_alive[1] = timestamp;
                Ok(())
            }
        } else {
            Err(ProgramError::GameInProgress)
        }
    }

    fn same(x_or_o: u8, triple: &[u8]) -> bool {
        triple.iter().all(|&i| i == x_or_o)
    }

    pub fn next_move(self: &mut Game, player: Pubkey, x: usize, y: usize) -> Result<()> {
        let board_index = y * 3 + x;
        if board_index >= self.board.len() || self.board[board_index] != BOARD_ITEM_FREE {
            return Err(ProgramError::InvalidMove);
        }

        let (x_or_o, won_state) = match self.game_state {
            GameState::XMove => {
                if player != self.player_x {
                    return Err(ProgramError::PlayerNotFound);
                }
                self.game_state = GameState::OMove;
                (BOARD_ITEM_X, GameState::XWon)
            }
            GameState::OMove => {
                if player != self.player_o {
                    return Err(ProgramError::PlayerNotFound);
                }
                self.game_state = GameState::XMove;
                (BOARD_ITEM_O, GameState::OWon)
            }
            _ => {
                return Err(ProgramError::NotYourTurn);
            }
        };
        self.board[board_index] = x_or_o;

        let winner =
            // Check rows
            Game::same(x_or_o, &self.board[0..3])
            || Game::same(x_or_o, &self.board[3..6])
            || Game::same(x_or_o, &self.board[6..9])
            // Check columns
            || Game::same(x_or_o, &[self.board[0], self.board[3], self.board[6]])
            || Game::same(x_or_o, &[self.board[1], self.board[4], self.board[7]])
            || Game::same(x_or_o, &[self.board[2], self.board[5], self.board[8]])
            // Check both diagonals
            || Game::same(x_or_o, &[self.board[0], self.board[4], self.board[8]])
            || Game::same(x_or_o, &[self.board[2], self.board[4], self.board[6]]);

        if winner {
            self.game_state = won_state;
        } else if self.board.iter().all(|&p| p != BOARD_ITEM_FREE) {
            self.game_state = GameState::Draw;
        }

        Ok(())
    }

    pub fn keep_alive(self: &mut Game, player: Pubkey, timestamp: u64) -> Result<()> {
        match self.game_state {
            GameState::Waiting | GameState::XMove | GameState::OMove => {
                if player == self.player_x {
                    info!("Player x keep_alive");
                    info!(timestamp, 0, 0, 0, 0);
                    if timestamp <= self.keep_alive[0] {
                        return Err(ProgramError::InvalidTimestamp);
                    }
                    self.keep_alive[0] = timestamp;
                } else if player == self.player_o {
                    info!("Player o keep_alive");
                    info!(timestamp, 0, 0, 0, 0);
                    if timestamp <= self.keep_alive[1] {
                        return Err(ProgramError::InvalidTimestamp);
                    }
                    self.keep_alive[1] = timestamp;
                } else {
                    return Err(ProgramError::PlayerNotFound);
                }
            }
            // Ignore keep_alive when game is no longer in progress
            GameState::XWon | GameState::OWon | GameState::Draw => {}
        };
        Ok(())
    }
}

#[cfg(test)]
mod test {
    extern crate std;
    use super::*;

    #[no_mangle]
    pub fn sol_log_(message: *const u8, length: u64) {
        std::println!("sol_log_");
        let slice = unsafe { std::slice::from_raw_parts(message, length as usize) };
        let string = std::str::from_utf8(&slice).unwrap();
        std::println!("{}", string);
    }

    #[test]
    pub fn column_1_x_wins() {
        /*
            X|O|
            -+-+-
            X|O|
            -+-+-
            X| |
        */

        let player_x: Pubkey = Pubkey::new(&[1; 32]);
        let player_o: Pubkey = Pubkey::new(&[1; 32]);

        let mut g = Game::new(player_x, player_o);
        assert_eq!(g.game_state, GameState::XMove);

        g.next_move(player_x, 0, 0).unwrap();
        assert_eq!(g.game_state, GameState::OMove);
        g.next_move(player_o, 1, 0).unwrap();
        assert_eq!(g.game_state, GameState::XMove);
        g.next_move(player_x, 0, 1).unwrap();
        assert_eq!(g.game_state, GameState::OMove);
        g.next_move(player_o, 1, 1).unwrap();
        assert_eq!(g.game_state, GameState::XMove);
        g.next_move(player_x, 0, 2).unwrap();
        assert_eq!(g.game_state, GameState::XWon);
    }

    #[test]
    pub fn right_diagonal_x_wins() {
        /*
            X|O|X
            -+-+-
            O|X|O
            -+-+-
            X| |
        */

        let player_x: Pubkey = Pubkey::new(&[1; 32]);
        let player_o: Pubkey = Pubkey::new(&[1; 32]);
        let mut g = Game::new(player_x, player_o);

        g.next_move(player_x, 0, 0).unwrap();
        g.next_move(player_o, 1, 0).unwrap();
        g.next_move(player_x, 2, 0).unwrap();
        g.next_move(player_o, 0, 1).unwrap();
        g.next_move(player_x, 1, 1).unwrap();
        g.next_move(player_o, 2, 1).unwrap();
        g.next_move(player_x, 0, 2).unwrap();
        assert_eq!(g.game_state, GameState::XWon);

        assert!(g.next_move(player_o, 1, 2).is_err());
    }

    #[test]
    pub fn bottom_row_o_wins() {
        /*
            X|X|
            -+-+-
            X| |
            -+-+-
            O|O|O
        */

        let player_x: Pubkey = Pubkey::new(&[1; 32]);
        let player_o: Pubkey = Pubkey::new(&[1; 32]);
        let mut g = Game::new(player_x, player_o);

        g.next_move(player_x, 0, 0).unwrap();
        g.next_move(player_o, 0, 2).unwrap();
        g.next_move(player_x, 1, 0).unwrap();
        g.next_move(player_o, 1, 2).unwrap();
        g.next_move(player_x, 0, 1).unwrap();
        g.next_move(player_o, 2, 2).unwrap();
        assert_eq!(g.game_state, GameState::OWon);

        assert!(g.next_move(player_x, 1, 2).is_err());
    }

    #[test]
    pub fn left_diagonal_x_wins() {
        /*
            X|O|X
            -+-+-
            O|X|O
            -+-+-
            O|X|X
        */

        let player_x: Pubkey = Pubkey::new(&[1; 32]);
        let player_o: Pubkey = Pubkey::new(&[1; 32]);
        let mut g = Game::new(player_x, player_o);

        g.next_move(player_x, 0, 0).unwrap();
        g.next_move(player_o, 1, 0).unwrap();
        g.next_move(player_x, 2, 0).unwrap();
        g.next_move(player_o, 0, 1).unwrap();
        g.next_move(player_x, 1, 1).unwrap();
        g.next_move(player_o, 2, 1).unwrap();
        g.next_move(player_x, 1, 2).unwrap();
        g.next_move(player_o, 0, 2).unwrap();
        g.next_move(player_x, 2, 2).unwrap();
        assert_eq!(g.game_state, GameState::XWon);
    }

    #[test]
    pub fn draw() {
        /*
            X|O|O
            -+-+-
            O|O|X
            -+-+-
            X|X|O
        */

        let player_x: Pubkey = Pubkey::new(&[1; 32]);
        let player_o: Pubkey = Pubkey::new(&[1; 32]);
        let mut g = Game::new(player_x, player_o);

        g.next_move(player_x, 0, 0).unwrap();
        g.next_move(player_o, 1, 1).unwrap();
        g.next_move(player_x, 0, 2).unwrap();
        g.next_move(player_o, 0, 1).unwrap();
        g.next_move(player_x, 2, 1).unwrap();
        g.next_move(player_o, 1, 0).unwrap();
        g.next_move(player_x, 1, 2).unwrap();
        g.next_move(player_o, 2, 2).unwrap();
        g.next_move(player_x, 2, 0).unwrap();

        assert_eq!(g.game_state, GameState::Draw);
    }

    #[test]
    pub fn solo() {
        /*
            X|O|
            -+-+-
             | |
            -+-+-
             | |
        */

        let player_x: Pubkey = Pubkey::new(&[1; 32]);

        let mut g = Game::new(player_x, player_x);
        assert_eq!(g.game_state, GameState::XMove);
        g.next_move(player_x, 0, 0).unwrap();
        assert_eq!(g.game_state, GameState::OMove);
        g.next_move(player_x, 1, 0).unwrap();
        assert_eq!(g.game_state, GameState::XMove);
    }
}
