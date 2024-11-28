#!/bin/bash

anvil --fork-url $ARBITRUM_ONE_RPC_URL

npx hardhat --network localhost run scripts/deploys/localhost/templegold/01-localhost.ts
