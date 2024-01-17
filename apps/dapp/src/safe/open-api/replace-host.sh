#!/bin/bash
if [[ "$VITE_ENV" == "production" ]]; then
    sed -ie 's/"host": .*"/"host": '\"safe-transaction-mainnet.safe.global\"'/g' apiv1.json
else 
    sed -ie 's/"host": .*"/"host": '\"safe-transaction-sepolia.safe.global\"'/g' apiv1.json
fi