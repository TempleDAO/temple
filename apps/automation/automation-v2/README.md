# Overlord automation code to for Temple

## Local testing against a local anvil fork

Start a local fork via anvil (substituting your ALCHEMY_KEY)

```bash
(
export MAINNET_RPC_URL=https://eth-mainnet.g.alchemy.com/v2/${ALCHEMY_KEY}
anvil --fork-url $MAINNET_RPC_URL
)
```

Edit the TASK_RUNNER_CONFIG variable in `main-localtest/${chain}.ts` if required. Then build and start it:

```bash
yarn build:localtest:${chain} && node dist/${chain}-localtest.js
```

This test setup exposes webhooks to trigger the automation tasks:

1. Run the required task, eg:

```bash
curl -X POST http://localhost:8111/webhooks/tlgddaigoldauction-a-start
```

## Testing TLC Liquidations

First update `tlc_discord_webhook_url` in `main-localtest/mainnet.ts` to your own local discord server webhook to get the test alerts.

```bash
# Terminal 1:
anvil --fork-url $MAINNET_RPC_URL --fork-block-number $BLOCK_NUMBER

# Terminal 2:
yarn dev:local:mainnet

# Terminal 3:
# Sets TPI to 0.5 so positions can be liquidated
curl -X POST http://localhost:8111/webhooks/tlc-setup-liquidations
# Performs the liquidation
curl -X POST http://localhost:8111/webhooks/tlc-batch-liquidate
```

You should receive an alert in discord.

If there are no user positions that can be liquidated, it would mean there are no users left 'at risk'.
Either set the TPI lower and/or update to manually select user addresses.
