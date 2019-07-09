#!/usr/bin/env bash

cd "$(dirname "$0")"

usage() {
    cat <<EOF

Usage: do.sh action <project>

If relative_project_path is ommitted then action will
be performed on all projects

Supported actions:
    build
    clean
    test
    clippy
    fmt

EOF
}

perform_action() {
    set -e
    case "$1" in
    build)
         ../node_modules/@solana/web3.js/bpf-sdk/rust/build.sh "$PWD"
         mkdir -p ../dist/program
         cp ./target/bpfel-unknown-unknown/release/tictactoe.so ../dist/program
        ;;
    clean)
         ../node_modules/@solana/web3.js/bpf-sdk/rust/clean.sh "$PWD"
        ;;
    test)
            echo "test $2"
            cargo +nightly test
        ;;
    clippy)
            echo "clippy $2"
            cargo +nightly clippy
        ;;
    fmt)
            echo "formatting $2"
            cargo fmt
        ;;
    help)
        usage
        exit
        ;;
    *)
        echo "Error: Unknown command"
        usage
        exit
        ;;
    esac
}

set -e

perform_action "$1"