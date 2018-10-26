use bincode;
use serde;
use serde_cbor;
use std;

use result::{ProgramError, Result};

pub trait CborAccountUserdata {
    fn serialize(&self, output: &mut [u8]) -> Result<()>
    where
        Self: std::marker::Sized + serde::Serialize,
    {
        let state_serialized = serde_cbor::to_vec(self)?;
        trace!("state_serialized length: {:?}", state_serialized.len());

        if output.len() < 4 + state_serialized.len() {
            error!(
                "Error: Buffer too small: {} < {}",
                output.len(),
                4 + state_serialized.len()
            );
            Err(ProgramError::AccountUserDataTooSmall)?;
        }

        {
            let writer = std::io::BufWriter::new(&mut output[..4]);
            bincode::serialize_into(writer, &state_serialized.len()).unwrap();
        }
        output[4..state_serialized.len() + 4].clone_from_slice(&state_serialized);
        Ok(())
    }

    fn deserialize<'a>(input: &'a [u8]) -> Self
    where
        Self: serde::Deserialize<'a> + Default,
    {
        if input.len() < 4 {
            return Default::default();
        }
        let len: u32 = bincode::deserialize(&input[..4]).unwrap();
        let len: usize = len as usize;
        if input.len() < len + 4 {
            return Default::default();
        }

        match serde_cbor::from_slice(&input[4..len + 4]) {
            Ok(state) => state,
            Err(err) => {
                error!("Error: Unable to deserialize: {:?}", err);
                Default::default()
            }
        }
    }
}

pub trait CborTransactionUserdata {
    fn serialize(&self) -> Vec<u8>
    where
        Self: std::marker::Sized + serde::Serialize,
    {
        serde_cbor::to_vec(self).unwrap()
    }

    fn deserialize<'a>(input: &'a [u8]) -> Result<Self>
    where
        Self: serde::Deserialize<'a>,
    {
        #[cfg_attr(feature = "cargo-clippy", allow(redundant_closure))]
        serde_cbor::from_slice::<Self>(input).map_err(|err| ProgramError::CBOR(err))
    }
}
