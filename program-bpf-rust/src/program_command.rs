use crate::simple_serde::SimpleSerde;

#[repr(C)]
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub enum Command {
    /// Initialize a dashboard account
    InitDashboard,
    /// Initialize a player account
    InitPlayer,
    /// Initialize a game account
    InitGame,
    /// Used by Player X to advertise their game
    Advertise,
    /// Player O wants to join
    Join,
    /// Player X/O keep alive
    KeepAlive,
    /// Player X/O mark board position (x, y)
    Move(u8, u8),
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
        assert_eq!(b[0..4], [0, 0, 0, 0]);

        let cmd = Command::InitPlayer;
        let mut b = vec![0; 16];
        cmd.serialize(&mut b).unwrap();
        assert_eq!(b[0..4], [1, 0, 0, 0]);

        let cmd = Command::InitGame;
        let mut b = vec![0; 16];
        cmd.serialize(&mut b).unwrap();
        assert_eq!(b[0..4], [2, 0, 0, 0]);

        let cmd = Command::Advertise;
        let mut b = vec![0; 16];
        cmd.serialize(&mut b).unwrap();
        assert_eq!(b[0..4], [3, 0, 0, 0]);

        let cmd = Command::Join;
        let mut b = vec![0; 16];
        cmd.serialize(&mut b).unwrap();
        assert_eq!(b[0..4], [4, 0, 0, 0]);

        let cmd = Command::KeepAlive;
        let mut b = vec![0; 16];
        cmd.serialize(&mut b).unwrap();
        assert_eq!(b[0..4], [5, 0, 0, 0]);

        let cmd = Command::Move(1, 2);
        let mut b = vec![0; 16];
        cmd.serialize(&mut b).unwrap();
        assert_eq!(b, [6, 0, 0, 0, 1, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
    }

    #[test]
    fn pull_in_externs() {
        // Rust on Linux excludes the solana_sdk_bpf_test library unless there is a
        // direct dependency, use this test to force the pull in of the library.
        // This is not necessary on macos and unfortunate on Linux
        // Issue: https://github.com/solana-labs/solana/issues/4972
        extern crate solana_sdk_bpf_test;
        use solana_sdk_bpf_test::*;
        unsafe { sol_log_("X".as_ptr(), 1) };
        sol_log_64_(1, 2, 3, 4, 5);
    }
}
