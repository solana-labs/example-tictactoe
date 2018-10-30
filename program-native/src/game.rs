use result::{ProgramError, Result};
use solana_sdk::pubkey::Pubkey;

#[derive(Copy, Clone, Debug, Serialize, Deserialize, PartialEq)]
enum BoardItem {
    F, // Free
    X,
    O,
}

impl Default for BoardItem {
    fn default() -> BoardItem {
        BoardItem::F
    }
}

#[derive(Copy, Clone, Debug, Serialize, Deserialize, PartialEq)]
pub enum State {
    Waiting,
    XMove,
    OMove,
    XWon,
    OWon,
    Draw,
}
impl Default for State {
    fn default() -> State {
        State::Waiting
    }
}

#[repr(C)]
#[derive(Debug, Default, Serialize, Deserialize, PartialEq)]
pub struct Game {
    player_x: Pubkey,
    player_o: Option<Pubkey>,
    pub state: State,
    board: [BoardItem; 9],
    keep_alive: [i64; 2],
}

impl Game {
    pub fn create(player_x: &Pubkey) -> Game {
        let mut game = Game::default();
        game.player_x = *player_x;
        assert_eq!(game.state, State::Waiting);
        game
    }

    #[cfg(test)]
    pub fn new(player_x: Pubkey, player_o: Pubkey) -> Game {
        let mut game = Game::create(&player_x);
        game.join(player_o, 1).unwrap();
        game
    }

    pub fn join(self: &mut Game, player_o: Pubkey, timestamp: i64) -> Result<()> {
        if self.state == State::Waiting {
            self.player_o = Some(player_o);
            self.state = State::XMove;

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

    fn same(x_or_o: BoardItem, triple: &[BoardItem]) -> bool {
        triple.iter().all(|&i| i == x_or_o)
    }

    pub fn next_move(self: &mut Game, player: Pubkey, x: usize, y: usize) -> Result<()> {
        let board_index = y * 3 + x;
        if board_index >= self.board.len() || self.board[board_index] != BoardItem::F {
            Err(ProgramError::InvalidMove)?;
        }

        let (x_or_o, won_state) = match self.state {
            State::XMove => {
                if player != self.player_x {
                    return Err(ProgramError::PlayerNotFound);
                }
                self.state = State::OMove;
                (BoardItem::X, State::XWon)
            }
            State::OMove => {
                if player != self.player_o.unwrap() {
                    return Err(ProgramError::PlayerNotFound);
                }
                self.state = State::XMove;
                (BoardItem::O, State::OWon)
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
            self.state = won_state;
        } else if self.board.iter().all(|&p| p != BoardItem::F) {
            self.state = State::Draw;
        }

        Ok(())
    }

    pub fn keep_alive(self: &mut Game, player: Pubkey, timestamp: i64) -> Result<()> {
        match self.state {
            State::Waiting | State::XMove | State::OMove => {
                if player == self.player_x {
                    if timestamp <= self.keep_alive[0] {
                        Err(ProgramError::InvalidTimestamp)?;
                    }
                    self.keep_alive[0] = timestamp;
                } else if Some(player) == self.player_o {
                    if timestamp <= self.keep_alive[1] {
                        Err(ProgramError::InvalidTimestamp)?;
                    }
                    self.keep_alive[1] = timestamp;
                } else {
                    Err(ProgramError::PlayerNotFound)?;
                }
            }
            // Ignore keep_alive when game is no longer in progress
            State::XWon | State::OWon | State::Draw => {}
        };
        Ok(())
    }
    /*
    pub fn process(self: &mut Self, player: &Pubkey, cmd: GameCommand) -> Result<()> {
        info!("Game::process: cmd={:?} player={}", cmd, player);
        info!("Game::process: account={:?}", self);

        match cmd {
            GameCommand::Join(timestamp) => self.join(*player, timestamp),
            GameCommand::Move(x, y) => self.next_move(*player, x as usize, y as usize),
            GameCommand::KeepAlive(timestamp) => self.keep_alive(*player, timestamp),
        }
    }
    */
}

#[cfg(test)]
mod test {
    use super::*;

    #[test]
    pub fn column_1_x_wins() {
        /*
            X|O|
            -+-+-
            X|O|
            -+-+-
            X| |
        */

        let player_x = Pubkey::new(&[1; 32]);
        let player_o = Pubkey::new(&[2; 32]);

        let mut g = Game::new(player_x, player_o);
        assert_eq!(g.state, State::XMove);

        g.next_move(player_x, 0, 0).unwrap();
        assert_eq!(g.state, State::OMove);
        g.next_move(player_o, 1, 0).unwrap();
        assert_eq!(g.state, State::XMove);
        g.next_move(player_x, 0, 1).unwrap();
        assert_eq!(g.state, State::OMove);
        g.next_move(player_o, 1, 1).unwrap();
        assert_eq!(g.state, State::XMove);
        g.next_move(player_x, 0, 2).unwrap();
        assert_eq!(g.state, State::XWon);
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

        let player_x = Pubkey::new(&[1; 32]);
        let player_o = Pubkey::new(&[2; 32]);
        let mut g = Game::new(player_x, player_o);

        g.next_move(player_x, 0, 0).unwrap();
        g.next_move(player_o, 1, 0).unwrap();
        g.next_move(player_x, 2, 0).unwrap();
        g.next_move(player_o, 0, 1).unwrap();
        g.next_move(player_x, 1, 1).unwrap();
        g.next_move(player_o, 2, 1).unwrap();
        g.next_move(player_x, 0, 2).unwrap();
        assert_eq!(g.state, State::XWon);

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

        let player_x = Pubkey::new(&[1; 32]);
        let player_o = Pubkey::new(&[2; 32]);
        let mut g = Game::new(player_x, player_o);

        g.next_move(player_x, 0, 0).unwrap();
        g.next_move(player_o, 0, 2).unwrap();
        g.next_move(player_x, 1, 0).unwrap();
        g.next_move(player_o, 1, 2).unwrap();
        g.next_move(player_x, 0, 1).unwrap();
        g.next_move(player_o, 2, 2).unwrap();
        assert_eq!(g.state, State::OWon);

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

        let player_x = Pubkey::new(&[1; 32]);
        let player_o = Pubkey::new(&[2; 32]);
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
        assert_eq!(g.state, State::XWon);
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

        let player_x = Pubkey::new(&[1; 32]);
        let player_o = Pubkey::new(&[2; 32]);
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

        assert_eq!(g.state, State::Draw);
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

        let player_x = Pubkey::new(&[1; 32]);

        let mut g = Game::new(player_x, player_x);
        assert_eq!(g.state, State::XMove);
        g.next_move(player_x, 0, 0).unwrap();
        assert_eq!(g.state, State::OMove);
        g.next_move(player_x, 1, 0).unwrap();
        assert_eq!(g.state, State::XMove);
    }
}
