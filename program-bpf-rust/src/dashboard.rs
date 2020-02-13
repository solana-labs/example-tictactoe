use crate::game::{Game, GameState};
use solana_sdk::{entrypoint::ProgramResult, pubkey::Pubkey};

const MAX_COMPLETED_GAMES: usize = 5;

#[repr(C)]
#[derive(Debug, Default, Clone, Serialize, Deserialize, PartialEq)]
pub struct Dashboard {
    /// Total number of completed games
    total_games: u64,
    /// Latest pending game                        
    pending_game: Pubkey,
    /// Last N completed games
    completed_games: [Pubkey; MAX_COMPLETED_GAMES],
    /// Index of the latest completed game
    latest_completed_game_index: u8,
}

impl Dashboard {
    pub fn update(self: &mut Dashboard, game_pubkey: &Pubkey, game: &Game) -> ProgramResult {
        match game.game_state {
            GameState::Waiting => {
                self.pending_game = *game_pubkey;
            }
            GameState::XMove | GameState::OMove => {
                // Nothing to do.  In progress games are not managed by the dashboard
            }
            GameState::XWon | GameState::OWon | GameState::Draw => {
                if !self
                    .completed_games
                    .iter()
                    .any(|pubkey| pubkey == game_pubkey)
                {
                    self.total_games += 1;
                    self.latest_completed_game_index =
                        (self.latest_completed_game_index + 1) % MAX_COMPLETED_GAMES as u8;
                    self.completed_games[self.latest_completed_game_index as usize] = *game_pubkey;
                }
            }
        }
        Ok(())
    }
}
