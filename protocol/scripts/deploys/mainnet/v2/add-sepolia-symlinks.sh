#!/bin/bash
# add duplicate deployment symlinks scripts

ln -s ../../sepolia/v2/contract-addresses.ts contract-addresses.ts
ln -s ../../sepolia/v2/tlc tlc

cd core
ln -s ../../../sepolia/v2/core/02-circuit-breaker-proxy.ts 02-circuit-breaker-proxy.ts
ln -s ../../../sepolia/v2/core/03-trv-tpi-oracle.ts 03-trv-tpi-oracle.ts
ln -s ../../../sepolia/v2/core/04-trv.ts 04-trv.ts
ln -s ../../../sepolia/v2/core/05-trv-dusd.ts 05-trv-dusd.ts
ln -s ../../../sepolia/v2/core/06-trv-dtemple-token.ts 06-trv-dtemple-token.ts
ln -s ../../../sepolia/v2/core/08-temple-base-strategy.ts 08-temple-base-strategy.ts
cd ..