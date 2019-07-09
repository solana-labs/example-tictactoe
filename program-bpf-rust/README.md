
### Building

This project cannot be built diretly via cargo and instead requires the build scripts located in Solana's BPF-SDK.

To build via NPM, from the repo's root directory:

`npm run build:bpf-rust`

You can also refer to the `build:bpf-rust` script in `package.json` as an example of how to call the build scripts directly

### Testing

Unit tests contained within this project can be built via:

`cargo +nightly test`

### Clippy

Clippy is also supported via:

`cargo +nightly clippy`
