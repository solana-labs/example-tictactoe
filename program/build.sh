#!/bin/bash -e

here="$(dirname "$0")"


maybeNoPull=
if [[ $1 = "--nopull" ]]; then
  maybeNoPull="--nopull"
fi

buildScript="
    cd program/;
    cargo fmt -- --check;
    cargo build;
    cargo clippy -- --deny=warnings;
    cargo test;
"

if [[ -n $SOLANA_ROOT ]]; then
  bash -xce "$buildScript"
else
  (
    set -x
    "$here"/docker-run.sh $maybeNoPull solanalabs/rust:1.30.0 bash -xce "$buildScript"
  )
fi

ls -l "$here"/target/debug/lib*.so

exit 0
