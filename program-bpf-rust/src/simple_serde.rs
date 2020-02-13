use crate::result::TicTacToeError;
use serde;
use solana_sdk::{entrypoint::ProgramResult, info, program_error::ProgramError};
use std::mem::size_of;

pub trait SimpleSerde: Clone {
    fn deserialize<'a>(input: &'a [u8]) -> Result<Self, ProgramError>
    where
        Self: serde::Deserialize<'a>,
    {
        if input.len() < size_of::<Self>() {
            info!("deserialize fail: input too small");
            info!(0, 0, 0, input.len(), size_of::<Self>());
            Err(TicTacToeError::DeserializationFailed.into())
        } else {
            let s: &Self = unsafe { &*(&input[0] as *const u8 as *const Self) };
            let c = (*s).clone();
            Ok(c)
        }
    }

    fn serialize(self: &Self, output: &mut [u8]) -> ProgramResult
    where
        Self: std::marker::Sized + serde::Serialize,
    {
        if output.len() < size_of::<Self>() {
            info!("serialize fail: output too small");
            Err(TicTacToeError::DeserializationFailed.into())
        } else {
            let state = unsafe { &mut *(&mut output[0] as *mut u8 as *mut Self) };
            *state = (*self).clone();
            Ok(())
        }
    }
}
