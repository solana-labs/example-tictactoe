use game::{Game, State};
use result::Result;
use solana_sdk::pubkey::Pubkey;

#[derive(Debug, Default, Serialize, Deserialize, PartialEq)]
pub struct Dashboard {
    pending: Pubkey,        // Latest pending game
    completed: Vec<Pubkey>, // Last N completed games (completed[0] is the latest)
    total: usize,           // Total number of completed games
}

impl Dashboard {
    pub fn update(self: &mut Dashboard, game_pubkey: &Pubkey, game: &Game) -> Result<()> {
        match game.state {
            State::Waiting => {
                self.pending = *game_pubkey;
            }
            State::XMove | State::OMove => {
                // Nothing to do.  In progress games are not managed by the dashboard
            }
            State::XWon | State::OWon | State::Draw => {
                if !self.completed.iter().any(|pubkey| pubkey == game_pubkey) {
                    // TODO: Once the PoH height is exposed to programs, it could be used to ensure
                    //       that old games are not being re-added and causing |total| to increment
                    //       incorrectly.
                    self.total += 1;
                    self.completed.insert(0, *game_pubkey);

                    // Only track the last N completed games to
                    // avoid overrunning Account userdata
                    if self.completed.len() > 5 {
                        self.completed.pop();
                    }
                }
            }
        };

        Ok(())
    }
}
