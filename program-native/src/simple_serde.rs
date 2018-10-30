use bincode;
use result::{ProgramError, Result};
use serde;
use std::mem::size_of;

pub trait SimpleSerde {
    fn map_to_invalid_args(err: std::boxed::Box<bincode::ErrorKind>) -> ProgramError {
        warn!("invalid argument: {:?}", err);
        ProgramError::InvalidUserdata
    }

    fn deserialize<'a>(input: &'a [u8]) -> Result<Self>
    where
        Self: serde::Deserialize<'a>,
    {
        if input.len() < size_of::<Self>() {
            warn!(
                "deserialize fail: input too small: {} < {}",
                input.len(),
                size_of::<Self>()
            );
            Err(ProgramError::InvalidUserdata)
        } else {
            bincode::deserialize(input).map_err(Self::map_to_invalid_args)
        }
    }

    fn serialize(self: &Self, output: &mut [u8]) -> Result<()>
    where
        Self: std::marker::Sized + serde::Serialize,
    {
        if output.len() < size_of::<Self>() {
            warn!(
                "serialize fail: output too small: {} < {}",
                output.len(),
                size_of::<Self>()
            );
            Err(ProgramError::InvalidUserdata)
        } else {
            let writer = std::io::BufWriter::new(output);
            bincode::serialize_into(writer, self).map_err(Self::map_to_invalid_args)
        }
    }
}
