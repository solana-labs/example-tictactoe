use dashboard;
use game;
use simple_serde::SimpleSerde;

#[derive(Debug, Serialize, Deserialize)]
#[cfg_attr(feature = "cargo-clippy", allow(large_enum_variant))]
pub enum State {
    Uninitialized,                   // State is not initialized yet
    Dashboard(dashboard::Dashboard), // State holds dashboard state
    Game(game::Game),                // State holds game state
}
impl Default for State {
    fn default() -> State {
        State::Uninitialized
    }
}
impl SimpleSerde for State {}
