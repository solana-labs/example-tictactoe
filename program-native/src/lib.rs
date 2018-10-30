extern crate bincode;
#[macro_use]
extern crate log;
extern crate serde;
#[macro_use]
extern crate serde_derive;
extern crate serde_cbor;
extern crate simple_logger;
extern crate solana_sdk;

mod cbor_serialize;
mod dashboard;
mod game;
mod logger;
mod result;

use solana_sdk::account::{Account, KeyedAccount};

use cbor_serialize::{CborAccountUserdata, CborTransactionUserdata};
use result::{ProgramError, Result};

#[derive(Debug, Serialize, Deserialize)]
pub enum InitCommand {
    InitGame,
    InitDashboard,
}
impl CborTransactionUserdata for InitCommand {}

#[derive(Debug, Serialize, Deserialize)]
pub enum GameCommand {
    Join(i64),      // player O wants to join (seconds since UNIX epoch)
    KeepAlive(i64), // player X/O keep alive (seconds since UNIX epoch)
    Move(u8, u8),   // player X/O mark board position (x, y)
}
impl CborTransactionUserdata for GameCommand {}

#[derive(Debug, Serialize, Deserialize)]
pub enum TicTacToeAccount {
    Uninitialized,
    Game(game::Game),
    Dashboard(dashboard::Dashboard),
}

impl Default for TicTacToeAccount {
    fn default() -> TicTacToeAccount {
        TicTacToeAccount::Uninitialized
    }
}

impl CborAccountUserdata for TicTacToeAccount {}

impl TicTacToeAccount {
    fn serialize_account(&self, account: &mut Account) -> Result<()> {
        self.serialize(&mut account.userdata)
    }
    fn deserialize_account(account: &Account) -> Self {
        Self::deserialize(&account.userdata)
    }

    fn process(info: &mut [KeyedAccount], input: &[u8]) -> Result<()> {
        if info.len() < 2 {
            error!(
                "Error: Expected at least 2 accounts, received {}",
                info.len()
            );
            Err(ProgramError::InvalidInput)?;
        }

        let mut state = Self::deserialize_account(&info[1].account);
        match state {
            TicTacToeAccount::Uninitialized => {
                if info[0].key != info[1].key {
                    error!("info[0]/info[1] mismatch");
                    Err(ProgramError::InvalidInput)?;
                }
                match InitCommand::deserialize(input)? {
                    InitCommand::InitGame => {
                        if info.len() < 3 {
                            error!("info[2] missing");
                            Err(ProgramError::InvalidInput)?;
                        }
                        info!(
                            "InitGame: game={:?} player_x={:?}",
                            info[1].key, info[2].key
                        );
                        state = TicTacToeAccount::Game(game::Game::create(&info[2].key));
                    }
                    InitCommand::InitDashboard => {
                        info!("InitDashboard: {:?}", info[1].key);
                        state = TicTacToeAccount::Dashboard(Default::default());
                    }
                }
            }
            TicTacToeAccount::Game(ref mut game) => {
                let player = info[0].key;
                let command = GameCommand::deserialize(input)?;
                info!("Game command: {:?}", command);
                match command {
                    GameCommand::Join(timestamp) => game.join(*player, timestamp),
                    GameCommand::Move(x, y) => game.next_move(*player, x as usize, y as usize),
                    GameCommand::KeepAlive(timestamp) => game.keep_alive(*player, timestamp),
                }?;
            }
            TicTacToeAccount::Dashboard(ref mut dashboard) => {
                if info.len() < 3 {
                    error!("info[2] missing");
                    Err(ProgramError::InvalidInput)?;
                }
                match Self::deserialize_account(&info[2].account) {
                    TicTacToeAccount::Game(ref game) => {
                        info!("Updating dashboard with game {:?}", game);
                        dashboard.update(&info[2].key, game)?;
                    }
                    _ => {
                        error!("info[2] not a game");
                        Err(ProgramError::InvalidInput)?;
                    }
                }
            }
        };

        state.serialize_account(&mut info[1].account)?;
        Ok(())
    }
}

#[no_mangle]
pub extern "C" fn process(info: &mut [KeyedAccount], input: &[u8]) -> bool {
    logger::setup();
    match TicTacToeAccount::process(info, input) {
        Err(err) => {
            error!("error: {:?}", err);
            false
        }
        Ok(_) => true,
    }
}
