use crate::dashboard;
use crate::game;
use crate::simple_serde::SimpleSerde;

#[repr(C)]
#[derive(Clone, Debug, Serialize, Deserialize)]
#[allow(clippy::large_enum_variant)]
pub enum State {
    /// State is not initialized yet
    Uninitialized,
    /// State holds dashboard state
    Dashboard(dashboard::Dashboard),
    /// State holds game state
    Game(game::Game),
}
impl SimpleSerde for State {}
