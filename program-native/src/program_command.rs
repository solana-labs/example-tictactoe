use simple_serde::SimpleSerde;

#[repr(C)]
#[derive(Debug, Serialize, Deserialize)]
pub enum Command {
    // Dashboard account commands
    InitDashboard,   // Initialize a dashboard account
    UpdateDashboard, // Update the dashboard with the provided game account

    // Game account commands
    InitGame,       // Initialize a game account
    Join(u64),      // Player O wants to join (seconds since UNIX epoch)
    KeepAlive(u64), // Player X/O keep alive (seconds since UNIX epoch)
    Move(u8, u8),   // Player X/O mark board position (x, y)
}
impl SimpleSerde for Command {}

#[cfg(test)]
mod test {
    use super::*;

    #[test]
    pub fn serialize() {
        let cmd = Command::InitDashboard;
        let mut b = vec![0; 16];
        cmd.serialize(&mut b).unwrap();
        assert_eq!(b, [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);

        let cmd = Command::UpdateDashboard;
        let mut b = vec![0; 16];
        cmd.serialize(&mut b).unwrap();
        assert_eq!(b, [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);

        let cmd = Command::InitGame;
        let mut b = vec![0; 16];
        cmd.serialize(&mut b).unwrap();
        assert_eq!(b, [2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);

        let cmd = Command::Join(12345678901234567890);
        let mut b = vec![0; 16];
        cmd.serialize(&mut b).unwrap();
        assert_eq!(
            b,
            [3, 0, 0, 0, 210, 10, 31, 235, 140, 169, 84, 171, 0, 0, 0, 0]
        );

        let cmd = Command::KeepAlive(0x1234567812345678);
        let mut b = vec![0; 16];
        cmd.serialize(&mut b).unwrap();
        assert_eq!(
            b,
            [4, 0, 0, 0, 120, 86, 52, 18, 120, 86, 52, 18, 0, 0, 0, 0]
        );

        let cmd = Command::Move(1, 2);
        let mut b = vec![0; 16];
        cmd.serialize(&mut b).unwrap();
        assert_eq!(b, [5, 0, 0, 0, 1, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
    }
}
