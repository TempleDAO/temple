#!/bin/bash

protocolDeployCommand="local-deploy";

if [ ${1:-local} == "e2e" ]; then
    protocolDeployCommand="local-deploy-e2e-test";
fi

echo "Using $protocolDeployCommand"

# Group our processes so ctrl+c will stop them all
trap "exit" INT TERM ERR
trap "kill 0" EXIT

# Clean hardhat, compile and deploy contracts
cd protocol 
yarn clean
yarn compile
yarn local-node & 

# Check node is alive
while [[ "$(curl -s -o /dev/null --request POST -w ''%{http_code}'' 'localhost:8545/' --header 'Content-Type: application/json' --data-raw '{
    "jsonrpc":"2.0",
    "method":"web3_clientVersion",
    "params":[],
    "id":1
}')" != "200" ]]; do sleep 5; done

echo 'Node is alive' 
echo 'Deploying'

yarn $protocolDeployCommand

# back to root
cd ..

# Sync compiled & deployed contracts into dapp
typechainSource="./protocol/typechain"
typechainTarget="./apps/dapp/src/types/"

rsync -avzh $typechainSource $typechainTarget

# Into the dapp we go
cd apps/dapp

# Run the dapp in dev mode
yarn dev &

wait