#!/bin/bash
if [[ "$VITE_ENV" == "production" ]]; then
    sed -ie 's/"host": .*"/"host": '\"safe-transaction-mainnet.safe.global\"'/g' apiV1.json
else 
    sed -ie 's/"host": .*"/"host": '\"safe-transaction-sepolia.safe.global\"'/g' apiV1.json
fi