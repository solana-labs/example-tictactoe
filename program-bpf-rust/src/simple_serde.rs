use crate::result::{ProgramError, Result};
use core::mem::size_of;
use serde;
use solana_sdk_bpf_utils::info;

pub trait SimpleSerde: Clone {
    fn deserialize<'a>(input: &'a [u8]) -> Result<Self>
    where
        Self: serde::Deserialize<'a>,
    {
        if input.len() < size_of::<Self>() {
            info!("deserialize fail: input too small");
            info!(0, 0, 0, input.len(), size_of::<Self>());
            Err(ProgramError::InvalidUserdata)
        } else {
            let s: &Self = unsafe { &*(&input[0] as *const u8 as *const Self) };
            let c = (*s).clone();
            Ok(c)
        }
    }

    fn serialize(self: &Self, output: &mut [u8]) -> Result<()>
    where
        Self: core::marker::Sized + serde::Serialize,
    {
        if output.len() < size_of::<Self>() {
            info!("serialize fail: output too small");
            Err(ProgramError::InvalidUserdata)
        } else {
            let state = unsafe { &mut *(&mut output[0] as *mut u8 as *mut Self) };
            *state = (*self).clone();
            Ok(())
        }
    }
}
