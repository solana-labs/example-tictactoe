#!/bin/bash -e
#
# Deploy programs to a running local network
#

here="$(dirname "$0")"

_() {
  echo "$PS4$*"
  "$@"
}

_ "$here"/build.sh --nopull

if [[ -n $SOLANA_ROOT ]]; then
  _ cp -fv "$here"/target/debug/libtictactoe.{dylib,so} "$SOLANA_ROOT"/target/debug/

else
  _ npx solana-localnet deploy "$here"/target/debug/libtictactoe.so
fi
