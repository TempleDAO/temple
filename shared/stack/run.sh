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

# Appends new env vars and updates any env vars that differ
input="shared/stack/deployed-addr.txt"
output="./apps/dapp/.env.local"
example="./apps/dapp/.env.local.example"

# Copy over the example as a skeleton if it doesn't exist already
if [ -f "$output" ]; then
    echo "$output exists."
else 
    echo "$output does not exist."
    cp "$example" "$output"
fi

while read -r line
do
    IFS='='
    read -a split <<<"$line"

    if ! grep -R "^[#]*\s*${split[0]}=.*" $output > /dev/null; then
        echo "APPENDING because '${split[0]}' not found"
        echo "${split[0]}=${split[1]}" >> $output
    else
        echo "SETTING because '${split[0]}' found already"
        # If only macOS used GNU tools
        if [[ "$OSTYPE" == "darwin"* ]]; then
            sed -i '' -r "s/^[#]*\s*${split[0]}=.*/${split[0]}=${split[1]}/" ${output}
        else
            sed -i -r  "s/^[#]*\s*${split[0]}=.*/${split[0]}=${split[1]}/" ${output}
        fi
    fi
done < "$input"

# Sync compiled & deployed contracts into dapp
typechainSource="./protocol/typechain"
typechainTarget="./apps/dapp/src/types/"

rsync -avzh $typechainSource $typechainTarget

# Into the dapp we go
cd apps/dapp

# Run the dapp in dev mode
yarn dev &

wait