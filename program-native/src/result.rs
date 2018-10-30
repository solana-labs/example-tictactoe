use std;

#[derive(Debug)]
pub enum ProgramError {
    InvalidInput,
    GameInProgress,
    InvalidMove,
    InvalidUserdata,
    InvalidTimestamp,
    NotYourTurn,
    PlayerNotFound,
}

pub type Result<T> = std::result::Result<T, ProgramError>;

impl std::fmt::Display for ProgramError {
    fn fmt(&self, f: &mut std::fmt::Formatter) -> std::fmt::Result {
        write!(f, "error")
    }
}

impl std::error::Error for ProgramError {}
