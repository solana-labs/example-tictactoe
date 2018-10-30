use simple_logger;
/// Setup function that is only run once, even if called multiple times.
use std::sync::{Once, ONCE_INIT};

static INIT: Once = ONCE_INIT;

pub fn setup() {
    INIT.call_once(|| simple_logger::init().unwrap());
}
