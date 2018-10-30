extern crate bincode;
#[macro_use]
extern crate log;
extern crate serde;
#[macro_use]
extern crate serde_derive;
extern crate simple_logger;
extern crate solana_sdk;

mod dashboard;
mod game;
mod logger;
mod program_command;
mod program_state;
mod result;
mod simple_serde;

use program_command::Command;
use program_state::State;
use result::{ProgramError, Result};
use simple_serde::SimpleSerde;
use solana_sdk::account::KeyedAccount;

fn expect_n_accounts(info: &mut [KeyedAccount], n: usize) -> Result<()> {
    if info.len() < n {
        error!(
            "Error: Expected at least {} accounts, received {}",
            n,
            info.len()
        );
        Err(ProgramError::InvalidInput)
    } else {
        Ok(())
    }
}

fn entrypoint(info: &mut [KeyedAccount], input: &[u8]) -> Result<()> {
    expect_n_accounts(info, 2)?;

    let command = Command::deserialize(input)?;
    debug!("entrypoint: command={:?}", command);
    let mut state = State::deserialize(&info[1].account.userdata)?;
    debug!("entrypoint: state={:?}", state);

    match state {
        State::Uninitialized => {
            if info[0].key != info[1].key {
                // InitGame/InitDashboard commands must be signed by the
                // state account itself
                error!("info[0]/info[1] mismatch");
                Err(ProgramError::InvalidInput)
            } else {
                match command {
                    Command::InitGame => {
                        expect_n_accounts(info, 3)?;
                        let player_x = info[2].key;
                        state = State::Game(game::Game::create(&player_x));
                        Ok(())
                    }
                    Command::InitDashboard => {
                        state = State::Dashboard(Default::default());
                        Ok(())
                    }
                    _ => {
                        error!("invalid command for State::Uninitialized");
                        Err(ProgramError::InvalidInput)
                    }
                }
            }
        }
        State::Game(ref mut game) => {
            let player = info[0].key;
            match command {
                Command::Join(timestamp) => game.join(*player, timestamp),
                Command::Move(x, y) => game.next_move(*player, x as usize, y as usize),
                Command::KeepAlive(timestamp) => game.keep_alive(*player, timestamp),
                _ => {
                    error!("invalid command for State::Game");
                    Err(ProgramError::InvalidInput)
                }
            }
        }
        State::Dashboard(ref mut dashboard) => {
            expect_n_accounts(info, 3)?;
            let mut game_state = State::deserialize(&info[2].account.userdata)?;
            match command {
                Command::UpdateDashboard => {
                    debug!("Updating dashboard with game {:?}", game_state);
                    if let State::Game(game) = game_state {
                        dashboard.update(&info[2].key, &game)
                    } else {
                        error!("invalid game state");
                        Err(ProgramError::InvalidInput)
                    }
                }
                _ => {
                    error!("invalid command for State::Dashboard");
                    Err(ProgramError::InvalidInput)
                }
            }
        }
    }?;

    state.serialize(&mut info[1].account.userdata)?;
    Ok(())
}

#[no_mangle]
pub extern "C" fn process(info: &mut [KeyedAccount], input: &[u8]) -> bool {
    logger::setup();

    trace!("process: info={:?} input={:?}", info, input);
    match entrypoint(info, input) {
        Err(err) => {
            error!("{:?}", err);
            false
        }
        Ok(_) => true,
    }
}
