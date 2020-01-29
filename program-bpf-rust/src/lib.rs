extern crate serde;
#[macro_use]
extern crate serde_derive;
extern crate solana_sdk;

mod dashboard;
mod game;
mod program_command;
mod program_state;
mod result;
mod simple_serde;

use program_command::Command;
use program_state::State;
use result::{ProgramError, Result as ProgramResult};
use simple_serde::SimpleSerde;
use solana_sdk::{
    account_info::AccountInfo,
    entrypoint,
    entrypoint::SUCCESS,
    info,
    pubkey::Pubkey,
    sysvar::{clock::Clock, Sysvar},
};

fn get_current_slot(account: &AccountInfo) -> u64 {
    let clock = Clock::from_account_info(&account).unwrap();
    clock.slot
}

fn expect_n_accounts(accounts: &mut [AccountInfo], n: usize) -> ProgramResult<()> {
    if accounts.len() < n {
        info!("Incorrect number of accounts");
        Err(ProgramError::InvalidInput)
    } else {
        Ok(())
    }
}

fn fund_to_cover_rent(
    accounts: &mut [AccountInfo],
    dashboard_index: usize,
    user_or_game_index: usize,
) -> ProgramResult<()> {
    static LOW_LAMPORT_WATERMARK: u64 = 300;
    if accounts[dashboard_index].lamports() <= 1 {
        info!("Dashboard is out of lamports");
        Err(ProgramError::InvalidInput)
    } else {
        if accounts[user_or_game_index].lamports() < LOW_LAMPORT_WATERMARK {
            info!("Fund account");
            info!(
                0,
                0,
                0,
                accounts[user_or_game_index].lamports(),
                accounts[dashboard_index].lamports()
            );
            // Fund the player or game account with enough lamports to pay for rent
            let to_fund = LOW_LAMPORT_WATERMARK - accounts[user_or_game_index].lamports();
            *accounts[user_or_game_index].borrow_mut().lamports += to_fund;
            *accounts[dashboard_index].borrow_mut().lamports -= to_fund;
        }
        Ok(())
    }
}

fn process_instruction(
    _program_id: &Pubkey,
    accounts: &mut [AccountInfo],
    data: &[u8],
) -> ProgramResult<()> {
    info!("tic-tac-toe program entrypoint");

    let command = Command::deserialize(data)?;

    if command == Command::InitDashboard {
        info!("init dashboard");
        const DASHBOARD_INDEX: usize = 0;
        expect_n_accounts(accounts, 1)?;

        let mut dashboard_state = State::deserialize(&accounts[DASHBOARD_INDEX].borrow().data)?;
        match dashboard_state {
            State::Uninitialized => {
                dashboard_state = State::Dashboard(Default::default());
                Ok(())
            }
            _ => {
                info!("Invalid dashboard state for InitDashboard");
                Err(ProgramError::InvalidInput)
            }
        }?;

        dashboard_state.serialize(&mut accounts[DASHBOARD_INDEX].borrow_mut().data)?;
        return Ok(());
    }

    if command == Command::InitPlayer {
        info!("init player");
        const DASHBOARD_INDEX: usize = 0;
        const PLAYER_INDEX: usize = 1;
        expect_n_accounts(accounts, 2)?;
        {
            let dashboard_state = State::deserialize(&accounts[DASHBOARD_INDEX].borrow().data)?;
            match dashboard_state {
                State::Dashboard(_) => Ok(()),
                _ => {
                    info!("Invalid dashboard state for InitPlayer");
                    Err(ProgramError::InvalidInput)
                }
            }?;

            if accounts[DASHBOARD_INDEX].owner != accounts[PLAYER_INDEX].owner
                || !accounts[PLAYER_INDEX].data_is_empty()
            {
                info!("Invalid player account for InitPlayer");
                return Err(ProgramError::InvalidInput);
            }
        }
        return fund_to_cover_rent(accounts, 0, 1);
    }

    const DASHBOARD_INDEX: usize = 1;
    expect_n_accounts(accounts, 3)?;
    let mut dashboard_state = State::deserialize(&accounts[DASHBOARD_INDEX].borrow().data)?;
    match dashboard_state {
        State::Dashboard(_) => Ok(()),
        _ => {
            info!("Invalid dashboard state");
            Err(ProgramError::InvalidInput)
        }
    }?;

    if command == Command::InitGame {
        info!("init game");
        const GAME_INDEX: usize = 0;
        const PLAYER_INDEX: usize = 2;
        expect_n_accounts(accounts, 3)?;
        let mut game_state = State::deserialize(&accounts[GAME_INDEX].borrow().data)?;

        if accounts[GAME_INDEX].owner != accounts[DASHBOARD_INDEX].owner {
            info!("Invalid game account for InitGame");
            return Err(ProgramError::InvalidInput);
        }
        if accounts[GAME_INDEX].owner != accounts[PLAYER_INDEX].owner
            || !accounts[PLAYER_INDEX].data_is_empty()
        {
            info!("Invalid player account for InitGame");
            return Err(ProgramError::InvalidInput);
        }

        match game_state {
            State::Uninitialized => {
                let game = game::Game::create(&accounts[PLAYER_INDEX].key);
                match dashboard_state {
                    State::Dashboard(ref mut dashboard) => {
                        dashboard.update(&accounts[GAME_INDEX].key, &game)
                    }
                    _ => {
                        info!("Invalid dashboard state for InitGame");
                        Err(ProgramError::InvalidInput)
                    }
                }?;
                game_state = State::Game(game);
                Ok(())
            }
            _ => {
                info!("Invalid game state for InitGame");
                Err(ProgramError::InvalidInput)
            }
        }?;

        dashboard_state.serialize(&mut accounts[DASHBOARD_INDEX].borrow_mut().data)?;
        game_state.serialize(&mut accounts[GAME_INDEX].borrow_mut().data)?;
        fund_to_cover_rent(accounts, 1, 0)?;
        return fund_to_cover_rent(accounts, 1, 2);
    }

    const PLAYER_INDEX: usize = 0;
    const GAME_INDEX: usize = 2;
    const SYSVAR_INDEX: usize = 3;

    expect_n_accounts(accounts, 4)?;

    let mut game_state = State::deserialize(&accounts[GAME_INDEX].borrow().data)?;
    if accounts[PLAYER_INDEX].owner != accounts[DASHBOARD_INDEX].owner
        || !accounts[PLAYER_INDEX].data_is_empty()
    {
        info!("Invalid player account");
        return Err(ProgramError::InvalidInput);
    }
    if accounts[DASHBOARD_INDEX].owner != accounts[GAME_INDEX].owner {
        info!("Invalid game account");
        return Err(ProgramError::InvalidInput);
    }

    match game_state {
        State::Game(ref mut game) => {
            let player = accounts[PLAYER_INDEX].key;
            let current_slot = get_current_slot(&accounts[SYSVAR_INDEX]);

            match command {
                Command::Advertise => {
                    info!("advertise game");
                    Ok(())
                } // Nothing to do here beyond the dashboard_update() below
                Command::Join => {
                    info!("join game");
                    game.join(*player, current_slot)
                }
                Command::Move(x, y) => {
                    info!("move");
                    game.next_move(*player, x as usize, y as usize)
                }
                Command::KeepAlive => {
                    info!("keep alive");
                    game.keep_alive(*player, current_slot)
                }
                _ => {
                    info!("invalid command for State::Game");
                    Err(ProgramError::InvalidInput)
                }
            }?;

            match dashboard_state {
                State::Dashboard(ref mut dashboard) => {
                    dashboard.update(&accounts[GAME_INDEX].key, &game)
                }
                _ => {
                    info!("Invalid dashboard state");
                    Err(ProgramError::InvalidInput)
                }
            }
        }
        _ => {
            info!("Invalid game state}");
            Err(ProgramError::InvalidInput)
        }
    }?;

    dashboard_state.serialize(&mut accounts[DASHBOARD_INDEX].borrow_mut().data)?;
    game_state.serialize(&mut accounts[GAME_INDEX].borrow_mut().data)?;
    fund_to_cover_rent(accounts, 1, 0)?;
    fund_to_cover_rent(accounts, 1, 2)
}

entrypoint!(_entrypoint);
fn _entrypoint(program_id: &Pubkey, accounts: &mut [AccountInfo], data: &[u8]) -> u32 {
    const FAILURE: u32 = 1;

    if !accounts[0].is_signer {
        info!("Account 0 did not sign the transaction");
        return FAILURE;
    }

    match process_instruction(program_id, accounts, data) {
        Err(err) => {
            err.print();
            FAILURE
        }
        _ => SUCCESS,
    }
}
