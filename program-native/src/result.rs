use serde_cbor;
use std;

#[derive(Debug)]
pub enum ProgramError {
    CBOR(serde_cbor::error::Error),
    AccountUserDataTooSmall,
    InvalidInput,
    GameInProgress,
    InvalidArguments,
    InvalidMove,
    InvalidUserdata,
    InvalidTimestamp,
    NoGame,
    NotYourTurn,
    PlayerNotFound,
    UserdataTooSmall,
}

pub type Result<T> = std::result::Result<T, ProgramError>;

impl std::fmt::Display for ProgramError {
    fn fmt(&self, f: &mut std::fmt::Formatter) -> std::fmt::Result {
        write!(f, "error")
    }
}

impl std::convert::From<serde_cbor::error::Error> for ProgramError {
    fn from(err: serde_cbor::error::Error) -> ProgramError {
        ProgramError::CBOR(err)
    }
}
impl std::error::Error for ProgramError {}
