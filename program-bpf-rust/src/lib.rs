#![no_std]

extern crate serde;
#[macro_use]
extern crate serde_derive;
#[cfg(not(test))]
extern crate solana_sdk_bpf_no_std;
extern crate solana_sdk_bpf_utils;

// required to use vec! in the program_command.h tests
#[cfg(test)]
#[macro_use]
extern crate alloc;

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
use solana_sdk_bpf_utils::entrypoint::*;
use solana_sdk_bpf_utils::{entrypoint, info};

fn get_current_slot(account: &SolKeyedAccount) -> u64 {
    #[allow(clippy::cast_ptr_alignment)]
    unsafe {
        *(&account.data[0] as *const u8 as *const u64)
    }
}

fn expect_n_accounts(info: &mut [SolKeyedAccount], n: usize) -> ProgramResult<()> {
    if info.len() < n {
        info!("Incorrect number of accounts");
        Err(ProgramError::InvalidInput)
    } else {
        Ok(())
    }
}

fn fund_next_move(
    info: &mut [SolKeyedAccount],
    dashboard_index: usize,
    user_or_game_index: usize,
) -> ProgramResult<()> {
    if *info[dashboard_index].lamports <= 1 {
        info!("Dashboard is out of lamports");
        Err(ProgramError::InvalidInput)
    } else {
        if *info[user_or_game_index].lamports != 0 {
            info!("User or Game still has lamports");
        } else {
            // TODO: the fee to charge may be dynamic based on the FeeCalculator and
            //       should be obtained via the Sysvar `SysvarFees111111111111111111111111111111111`
            let fee = 3;
            *info[user_or_game_index].lamports += fee;
            *info[dashboard_index].lamports -= fee;
        }
        Ok(())
    }
}

fn process_instruction(
    info: &mut [SolKeyedAccount],
    _: &SolClusterInfo,
    data: &[u8],
) -> ProgramResult<()> {
    let command = Command::deserialize(data)?;

    if command == Command::InitDashboard {
        const DASHBOARD_INDEX: usize = 0;
        expect_n_accounts(info, 1)?;
        let mut dashboard_state = State::deserialize(&info[DASHBOARD_INDEX].data)?;

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

        dashboard_state.serialize(&mut info[DASHBOARD_INDEX].data)?;
        return Ok(());
    }

    if command == Command::InitPlayer {
        const DASHBOARD_INDEX: usize = 0;
        const PLAYER_INDEX: usize = 1;
        expect_n_accounts(info, 2)?;
        {
            let dashboard_state = State::deserialize(&info[DASHBOARD_INDEX].data)?;
            match dashboard_state {
                State::Dashboard(_) => Ok(()),
                _ => {
                    info!("Invalid dashboard state for InitPlayer");
                    Err(ProgramError::InvalidInput)
                }
            }?;

            if info[DASHBOARD_INDEX].owner != info[PLAYER_INDEX].owner
                || !info[PLAYER_INDEX].data.is_empty()
            {
                info!("Invalid player account for InitPlayer");
                Err(ProgramError::InvalidInput)?;
            }
        }
        return fund_next_move(info, 0, 1);
    }

    const DASHBOARD_INDEX: usize = 1;
    expect_n_accounts(info, 3)?;
    let mut dashboard_state = State::deserialize(&info[DASHBOARD_INDEX].data)?;
    match dashboard_state {
        State::Dashboard(_) => Ok(()),
        _ => {
            info!("Invalid dashboard state");
            Err(ProgramError::InvalidInput)
        }
    }?;

    if command == Command::InitGame {
        const GAME_INDEX: usize = 0;
        const PLAYER_INDEX: usize = 2;
        expect_n_accounts(info, 3)?;
        let mut game_state = State::deserialize(&info[GAME_INDEX].data)?;

        if info[GAME_INDEX].owner != info[DASHBOARD_INDEX].owner {
            info!("Invalid game account for InitGame");
            Err(ProgramError::InvalidInput)?;
        }
        if info[GAME_INDEX].owner != info[PLAYER_INDEX].owner || !info[PLAYER_INDEX].data.is_empty()
        {
            info!("Invalid player account for InitGame");
            Err(ProgramError::InvalidInput)?;
        }

        match game_state {
            State::Uninitialized => {
                let game = game::Game::create(&info[PLAYER_INDEX].key);
                match dashboard_state {
                    State::Dashboard(ref mut dashboard) => {
                        dashboard.update(&info[GAME_INDEX].key, &game)
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

        dashboard_state.serialize(&mut info[DASHBOARD_INDEX].data)?;
        game_state.serialize(&mut info[GAME_INDEX].data)?;
        fund_next_move(info, 1, 0)?;
        return fund_next_move(info, 1, 2);
    }

    const PLAYER_INDEX: usize = 0;
    const GAME_INDEX: usize = 2;
    const SYSVAR_INDEX: usize = 3;

    expect_n_accounts(info, 4)?;

    let mut game_state = State::deserialize(&info[GAME_INDEX].data)?;
    if info[PLAYER_INDEX].owner != info[DASHBOARD_INDEX].owner
        || !info[PLAYER_INDEX].data.is_empty()
    {
        info!("Invalid player account");
        Err(ProgramError::InvalidInput)?;
    }
    if info[DASHBOARD_INDEX].owner != info[GAME_INDEX].owner {
        info!("Invalid game account");
        Err(ProgramError::InvalidInput)?;
    }

    match game_state {
        State::Game(ref mut game) => {
            let player = info[PLAYER_INDEX].key;
            let current_slot = get_current_slot(&info[SYSVAR_INDEX]);

            match command {
                Command::Advertise => Ok(()), // Nothing to do here beyond the dashboard_update() below
                Command::Join => game.join(*player, current_slot),
                Command::Move(x, y) => game.next_move(*player, x as usize, y as usize),
                Command::KeepAlive => game.keep_alive(*player, current_slot),
                _ => {
                    info!("invalid command for State::Game");
                    Err(ProgramError::InvalidInput)
                }
            }?;

            match dashboard_state {
                State::Dashboard(ref mut dashboard) => {
                    dashboard.update(&info[GAME_INDEX].key, &game)
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

    dashboard_state.serialize(&mut info[DASHBOARD_INDEX].data)?;
    game_state.serialize(&mut info[GAME_INDEX].data)?;
    // Distribute funds to the player for their next transaction
    fund_next_move(info, 1, 0)
}

entrypoint!(_entrypoint);
fn _entrypoint(keyed_accounts: &mut [SolKeyedAccount], info: &SolClusterInfo, data: &[u8]) -> bool {
    if !keyed_accounts[0].is_signer {
        info!("key 0 did not sign the transaction");
        return false;
    }

    match process_instruction(keyed_accounts, info, data) {
        Err(err) => {
            err.print();
            false
        }
        _ => true,
    }
}
