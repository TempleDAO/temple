# Adding a Team Payments Epoch

Epoch numbers track quarters, letters track months within the quarter: `33a`, `33b`,
`33c`, then `34a`. The last entry of `teamPayments` in
`apps/dapp/src/constants/env/production.tsx` shows the current one.

Run commands from `protocol/`.

## 1. Before the deploy

The CSV arrives in this form, with the amounts and an empty address on the last row:

```csv
total_usd,address
6000,0xd8997EF690647d1B85aCF906e7Dd5cC6CAee43E0
100,0xB8C400E4E9360ae7a3480A2F63e2A5aA85696148
199100,
```

Write it to `scripts/deploys/mainnet/team-payments/json/epoch33a.csv`, then convert it.
The script rejects the file, and writes no JSON, if the amounts miss the total on the
last row or an address appears twice:

```bash
cd scripts/deploys/mainnet/team-payments && ./csv-to-json.sh json/epoch33a.csv
```

Leave the CSV uncommitted.

Then make three edits, leaving both addresses empty for now:

- `scripts/deploys/mainnet/team-payments/deploy.ts` — point the `snapshot` import at
  `./json/epoch33a.json`.
- `scripts/deploys/helpers.ts` — add `TEMPLE_TEAM_EPOCH_33A: string;` to the
  `TeamPayments` interface and `TEMPLE_TEAM_EPOCH_33A: '',` to the mainnet
  `TEAM_PAYMENTS` block.
- `apps/dapp/src/constants/env/production.tsx` — append to `teamPayments`. Array index
  maps to epoch order, so append only:

```ts
{
  name: 'Epoch 33a',
  address: '',
},
```

## 2. Ask the user to deploy

Stop here. Ask the user to run this and paste back the output:

```bash
./scripts/run-hardhat.sh mainnet scripts/deploys/mainnet/team-payments/deploy.ts
```

## 3. After the deploy

The output ends with an `https://etherscan.io/address/0x...` line carrying the contract
address, the total allocated, and the address count. Check the total and count against
the CSV, then put that address in both placeholders from step 1.

Pass the `yarn hardhat verify` line from the output back to the user.

## 4. Commit

A single commit, `feat: epoch 33a`, covering four files:

- `apps/dapp/src/constants/env/production.tsx`
- `protocol/scripts/deploys/helpers.ts`
- `protocol/scripts/deploys/mainnet/team-payments/deploy.ts`
- `protocol/scripts/deploys/mainnet/team-payments/json/epoch33a.json`
