use solana_sdk::info;

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

impl ProgramError {
    pub fn print(&self) {
        match self {
            ProgramError::InvalidInput => info!("Error: InvalidInput"),
            ProgramError::GameInProgress => info!("Error: GameInProgress"),
            ProgramError::InvalidMove => info!("Error: InvalidMove"),
            ProgramError::InvalidUserdata => info!("Error: InvalidUserdata"),
            ProgramError::InvalidTimestamp => info!("Error: InvalidTimestamp"),
            ProgramError::NotYourTurn => info!("Error: NotYourTurn"),
            ProgramError::PlayerNotFound => info!("Error: PlayerNotFound"),
        }
    }
}
