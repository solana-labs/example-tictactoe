The native program variant is only available on a local instance of Solana and
cannot be deployed to the public testnet.

### Development
Ensure rust and cargo are installed (see https://rustup.rs/ for more)

To compile:
```sh
$ ./program-native/build.sh
```
or
```
$ npm run build:native
```

Then run the following commands to deploy to a local Solana network:
```sh
$ npm run localnet:up
$ npm run localnet:deloy
```

Note: the local network must be restarted any time the native program is changed
as redeploys of native programs are not supported.

Ensure `export NATIVE=1` is defined in your environment before
starting the front end to select the native program.

