extern crate bincode;
#[macro_use]
extern crate log;
extern crate serde;
#[macro_use]
extern crate serde_derive;
extern crate simple_logger;
#[macro_use]
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
use result::{ProgramError, Result as ProgramResult};
use simple_serde::SimpleSerde;
use solana_sdk::account::KeyedAccount;
use solana_sdk::pubkey::Pubkey;

fn expect_n_accounts(info: &mut [KeyedAccount], n: usize) -> ProgramResult<()> {
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

fn fund_next_move(
    info: &mut [KeyedAccount],
    dashboard_index: usize,
    user_or_game_index: usize,
) -> ProgramResult<()> {
    if info[dashboard_index].account.lamports <= 1 {
        error!("Dashboard is out of lamports");
        Err(ProgramError::InvalidInput)
    } else {
        if info[user_or_game_index].account.lamports != 0 {
            debug!("user_or_game still has lamports");
        } else {
            // TODO: the fee to charge may be dynamic based on the FeeCalculator and
            //       instead probably needs to be passed in as an argument somehow
            let fee = 3;
            info[user_or_game_index].account.lamports += fee;
            info[dashboard_index].account.lamports -= fee;
        }
        Ok(())
    }
}

fn process_instruction(
    info: &mut [KeyedAccount],
    input: &[u8],
    tick_height: u64,
) -> ProgramResult<()> {
    let command = Command::deserialize(input)?;
    debug!("entrypoint: command={:?}", command);

    if command == Command::InitDashboard {
        expect_n_accounts(info, 1)?;
        let mut dashboard_state = State::deserialize(&info[0].account.userdata)?;

        match dashboard_state {
            State::Uninitialized => {
                dashboard_state = State::Dashboard(Default::default());
                Ok(())
            }
            _ => {
                error!(
                    "Invalid dashboard state for InitDashboard: {:?}",
                    dashboard_state
                );
                Err(ProgramError::InvalidInput)
            }
        }?;
        dashboard_state.serialize(&mut info[0].account.userdata)?;
        return Ok(());
    }

    if command == Command::InitPlayer {
        expect_n_accounts(info, 2)?;
        {
            let dashboard_state = State::deserialize(&info[0].account.userdata)?;
            match dashboard_state {
                State::Dashboard(_) => Ok(()),
                _ => {
                    error!(
                        "Invalid dashboard state for InitPlayer: {:?}",
                        dashboard_state
                    );
                    Err(ProgramError::InvalidInput)
                }
            }?;

            if info[0].account.owner != info[1].account.owner || info[1].account.userdata.len() != 0
            {
                error!(
                    "Invalid player account for InitPlayer: {:?}",
                    dashboard_state
                );
                Err(ProgramError::InvalidInput)?;
            }
        }
        return fund_next_move(info, 0, 1);
    }

    expect_n_accounts(info, 3)?;
    let mut dashboard_state = State::deserialize(&info[1].account.userdata)?;
    match dashboard_state {
        State::Dashboard(_) => Ok(()),
        _ => {
            error!("Invalid dashboard state: {:?}", dashboard_state);
            Err(ProgramError::InvalidInput)
        }
    }?;

    if command == Command::InitGame {
        let mut game_state = State::deserialize(&info[0].account.userdata)?;

        if info[0].account.owner != info[1].account.owner {
            error!("Invalid game account for InitGame: {:?}", dashboard_state);
            Err(ProgramError::InvalidInput)?;
        }
        if info[0].account.owner != info[2].account.owner || info[2].account.userdata.len() != 0 {
            error!("Invalid player account for InitGame: {:?}", dashboard_state);
            Err(ProgramError::InvalidInput)?;
        }

        match game_state {
            State::Uninitialized => {
                let game = game::Game::create(&info[2].unsigned_key());
                match dashboard_state {
                    State::Dashboard(ref mut dashboard) => {
                        dashboard.update(&info[1].unsigned_key(), &game)
                    }
                    _ => {
                        error!(
                            "Invalid dashboard state for InitGame: {:?}",
                            dashboard_state
                        );
                        Err(ProgramError::InvalidInput)
                    }
                }?;
                game_state = State::Game(game);
                Ok(())
            }
            _ => {
                error!("Invalid game state for InitGame: {:?}", game_state);
                Err(ProgramError::InvalidInput)
            }
        }?;

        dashboard_state.serialize(&mut info[1].account.userdata)?;
        game_state.serialize(&mut info[0].account.userdata)?;
        fund_next_move(info, 1, 0)?;
        return fund_next_move(info, 1, 2);
    }

    let mut game_state = State::deserialize(&info[2].account.userdata)?;
    if info[0].account.owner != info[1].account.owner || info[0].account.userdata.len() != 0 {
        error!("Invalid player account");
        Err(ProgramError::InvalidInput)?;
    }
    if info[1].account.owner != info[2].account.owner {
        error!("Invalid game account");
        Err(ProgramError::InvalidInput)?;
    }

    match game_state {
        State::Game(ref mut game) => {
            let player = info[0].signer_key().unwrap();
            match command {
                Command::Advertise => Ok(()), // Nothing to do here beyond the dashboard_update() below
                Command::Join => game.join(*player, tick_height),
                Command::Move(x, y) => game.next_move(*player, x as usize, y as usize),
                Command::KeepAlive => game.keep_alive(*player, tick_height),
                _ => {
                    error!("invalid command for State::Game");
                    Err(ProgramError::InvalidInput)
                }
            }?;

            match dashboard_state {
                State::Dashboard(ref mut dashboard) => {
                    dashboard.update(&info[1].unsigned_key(), &game)
                }
                _ => {
                    error!("Invalid dashboard stat: {:?}", dashboard_state);
                    Err(ProgramError::InvalidInput)
                }
            }
        }
        _ => {
            error!("Invalid game state: {:?}", game_state);
            Err(ProgramError::InvalidInput)
        }
    }?;

    dashboard_state.serialize(&mut info[1].account.userdata)?;
    game_state.serialize(&mut info[2].account.userdata)?;
    // Distribute funds to the player for their next transaction
    return fund_next_move(info, 1, 0);
}

solana_entrypoint!(entrypoint);
fn entrypoint(
    _program_id: &Pubkey,
    keyed_accounts: &mut [KeyedAccount],
    data: &[u8],
    tick_height: u64,
) -> Result<(), ProgramError> {
    logger::setup();

    if keyed_accounts[0].signer_key().is_none() {
        error!("key 0 did not sign the transaction");
        return Err(ProgramError::InvalidInput);
    }

    match process_instruction(keyed_accounts, data, tick_height) {
        Err(err) => {
            error!("{:?}", err);
            Err(err)
        }
        _ => Ok(()),
    }
}
