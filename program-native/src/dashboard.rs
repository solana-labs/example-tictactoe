use game::{Game, GameState};
use result::Result;
use solana_sdk::pubkey::Pubkey;

const MAX_COMPLETED_GAMES: usize = 5;

#[repr(C)]
#[derive(Debug, Default, Serialize, Deserialize, PartialEq)]
pub struct Dashboard {
    total_games: u64,                               // Total number of completed games
    pending_game: Pubkey,                           // Latest pending game
    completed_games: [Pubkey; MAX_COMPLETED_GAMES], // Last N completed games
    latest_completed_game_index: u8,                // Index of the latest completed game
}

impl Dashboard {
    pub fn update(self: &mut Dashboard, game_pubkey: &Pubkey, game: &Game) -> Result<()> {
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
        };
        Ok(())
    }
}
