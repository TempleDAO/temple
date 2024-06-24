# Protocol Name 
Temple DAO

<!-- <br/>
<p align="center">
<img src="./logo.png" width="500" alt="project-name">
</p>
<br/> --> 


# Contest Details TO BE FILLED OUT BY CYFRIN

### Prize Pool TO BE FILLED OUT BY CYFRIN

- Total Pool - 
- H/M -  
- Low -
- Community Judging - 

- Starts: TBD
- Ends: TBD

### Stats TO BE FILLED OUT BY CYFRIN

- nSLOC: 
- Complexity Score:

## About the Project

TEMPLE is a Treasury asset-backed token created by the TempleDAO team. By facilitating long-term, stable wealth creation with a community-first mindset, TEMPLE is a safe haven in a sea of risky assets. The spot price of TEMPLE is maintained by an AMO system that uses a book value metric called "Treasury Price Index" (TPI) as a price floor. The TPI is only denominated in stables or stable-like assets and excludes volatile tokens such as ETH. This means that a significant portion of the Temple Treasury has not yet been priced into the $TEMPLE spot price, or enforced by the AMO which discounts extrinsic value to zero.

TempleDAO is introducing new cross-chain ERC20 token Temple Gold (TGLD) which will serve serve as the "Points" token for the Protocol (https://templedao.medium.com/he-who-controls-the-spice-controls-the-universe-bae5fb92bd43). The token itself is more similar to "store credit" or "airline miles" than a typical volatile token freely traded on an AMM. Temple Gold holders will be able to redeem their TGLD for select Treasury volatile assets that the Protocol has or will receive via early participant incentives such as an airdrop. An example of a volatile token that can be redeemed using TGLD would be ENA (Ethena's governance token) which the Temple Treasury has farmed over the past six months, as well as other tokens from our early efforts to bootstrap liquidity for Partners such as Wasabi Finance.

TGLD will be distributed to users through 3 ways: 1/ Receive as a reward for TEMPLE staking (20% excluding TEMPLE borrowers), 2/ Grant to the Team for use as a hiring or retention incentive (10%); and 3/ Acquire at Temple Gold Auction via DAI bids (70%). TGLD inherits from LayerZero’s OFT standard to make cross-chain available while the token is only minted on Arbitrum chain. This means that once minted, TGLD can be transferred to redeem Temple Treasury rewards on any chain. TGLD emissions will be ongoing and the rate will depend on the current circulating supply e.g. if circulating supply is low the TGLD emission rate is higher and vice versa. The user's staked TEMPLE balance will also determine their overall governance voting weight in terms of controlling the Auction parameters and other Protocol parameters. There's no other way to acquire TGLD as TGLD is non-transferrable and there will be no AMM LP pool for TGLD. 

In a Temple Gold Auction (DAI for TGLD), Bidders--including users who do not have any TEMPLE--can put in DAI bids and receive TGLD tokens pro rata relative to the final DAI bid price for the TGLD lot. For instance, if 1mm TGLD tokens were put up in the TGLD Auction and 100K DAI was collected from Bidders, then each Bidder will receive 10 TGLD per DAI. Similarly, a Spice Auction (TGLD for <TOKEN>), Holders can bid using TGLD tokens and at the end of the auction, everyone will receive TGLD pro rata relative to the final TGLD price for the <TOKEN> lot. The TGLD Auctions (DAI Bids) will take place on a bi-weekly cadence whereas the Spice Auctions (TGLD Bids) will be held irregularly. Both the choice of the volatile token and the amount for a given Spice Auction will be subject to community consultation/voting as well as any restrictions imposed by the Partner where applicable.

In summary, Temple Gold is the currency of the Spice Bazaar, a novel framework for the creation and transfer of value in the Temple ecosystem. Through the two main types of Spice Bazaar auctions, TempleDAO hopes to achieve 3 main objectives: 1/ Maintain strong Partner relations by avoiding unnecessary price volatility for both TEMPLE and the Partner token; 2/ Encourage the market to price in the TGLD premium for $TEMPLE by creating a way to sustainably extract the extrinsic value of the Treasury; 3/ Establish a scalable means for new capital to flow into the Protocol to re-capitalize and re-invest in its future. 


[TempleGold Documentation](https://github.com/TempleDAO/temple/tree/templegold/protocol/contracts/templegold/README.md)
[Website](https://templedao.link/)
[TempleGold Github branch](https://github.com/TempleDAO/temple/tree/templegold)
[Twitter](https://x.com/templedao)

### Temple Gold

- Temple Gold (TGLD) is a non-tradable non-transferrable cross-chain ERC20 token.
- A TGLD holder can only transfer cross-chain to their own account address
- TGLD can be transferred to whitelisted addresses. These are TempleGoldStaking, DaiGoldAuction, SpiceAuction and team gnosis multisig address
- TGLD uses layer zero for cross-chain functionality.

### Dai Gold Auction

- In DaiGold auctions, bidders bid DAI in exchange for TGLD when an auction is active. These Temple Gold tokens available for each auction are sent to `DaiGoldAuction` contract prior to auction starting. 

- `TempleGold.mint()` distributes TGLD tokens on mint to DaiGoldAuction, Staking contracts and team multisig using distribution share parameters percentages set at `DistributionParams`. Temple Gold reward tokens for each auction are shared amongst DAI bidders/depositors after the auction has ended. DAI depositors can claim their share of the TGOLD rewards after auction and also retroactively.

- Bid token can be updated later using `setBidToken`. It can be assumed that the bid token has no funky internal taxes or fees, callbacks or complex functionalities beyond the usual OZ ERC20 functions.

- Each auction lasts for 1 week. Proceeds from auctions are sent directly to treasury.

### Temple Gold Staking

- Stakers stake Temple tokens for Temple Gold rewards.

- Temple can be transferred cross-chain to Arbitrum One using the `TempleTeleporter` contract. Temple tokens are burned on mainnet and same amount of tokens are minted on arbitrum one.

- A staker's vote is read from Staking. When a user stakes or withdraws, their delegate's vote is updated. A staker participating in governance must set delegate to either own address or another address using `delegate()`. Setting delegate to address zero means no participation in governance(default).

- Migration is built in, if there is an upgrade to staking contract. First, `setMigrator()` is called. Migrator is the next staking contract. Migrator calls `migrateWithdraw()` to withdraw and migrate staker's stake amount and optionally claim rewards. Rewards can be claimed after migration.

- Staking contract will be deployed to Arbitrum One chain.

### Spice Auction

- In a spice auction, a "spice" token is bid for Temple Gold or vice versa. Each spice auction epoch has a different configuration.
```solidity
struct SpiceAuctionConfig {
    /// @notice Duration of auction
    uint32 duration;
    /// @notice Minimum time between successive auctions
    uint32 waitPeriod;
    /// @notice Cooldown after auction start is triggered, to allow deposits
    uint32 startCooldown;
    /// @notice Minimum Gold distributed to enable auction start
    uint160 minimumDistributedAuctionToken;
    /// @notice Address to start next auction when all criteria are met. Address zero means anyone can trigger start
    address starter;
    /// @notice Is Temple Gold auction token
    bool isTempleGoldAuctionToken;
    /// @notice Mode of auction activation
    ActivationMode activationMode;
    /// @notice Auction proceeds recipient
    address recipient;
}

```
- Spice auction configuration are set and controlled by the DAO executor (part of the governance process). Each spice auction contract is configured with one spice token and TGLD. Spice auction contracts are deployed via `SpiceAuctionFactory`.

- The Layer Zero integration enables Temple Gold (TGLD) use in spice bazaar auctions cross-chain.

## Actors

```
Actors:
    Elevated Access: Gnosis multisig address of Temple DAO. Not set up yet but ideally a 3/4 multisig address. Elevated access controls staking and TGLD parameters. There is centralization risks if 3 addresses get compromised.
    Staker: Account staking Temple for TGLD rewards
    DAO Executor: Temple DAO governance executor contract. Controls spice auction configuration and parameters through governance.
    Distribution starter: A bot if set to non-zero address. Distributes TGLD for the next reward epoch
```

## Scope (contracts)

All Contracts in `contracts/templegold` are in scope.
```js
contracts/
└── templegold
    ├── AuctionBase.sol
    ├── DaiGoldAuction.sol
    ├── EpochLib.sol
    ├── SpiceAuction.sol
    ├── SpiceAuctionFactory.sol
    ├── TempleGold.sol
    ├── TempleGoldAdmin.sol
    ├── TempleGoldStaking.sol
    └── TempleTeleporter.sol
```

| #     | File              | nSLOC | Description |
|  :-:  | :---------------- | :------: | :------------------- |
|   1   | contracts/templegold/AuctionBase.sol       |   10   | Base auction contract. Inherited by `DaiGoldAuction.sol` and `SpiceAuction.sol` |
|   2   | contracts/templegold/DaiGoldAuction.sol          |   158   | An auction contract for deposits of bid token to bid on a share of distributed TGLD for every epoch. Once bid, users cannot withdraw their bid token and can claim their share of Temple Gold for epoch after auction finishes. |
|   3   | contracts/templegold/EpochLib.sol    |  13   | A library for `DaiGoldAuction` and `SpiceAuction` for epoch time validations |
|   4   | contracts/templegold/SpiceAuction.sol |  191   | A special auction configured with a "spice" token and TGLD. For every auction epoch spice token or TGLD can be the auction token or vice versa. Spice auctions are controlled by governance. Configuration for an epoch is set before the epoch auction starts. |
|   5   | contracts/templegold/SpiceAuctionFactory.sol |  42   | Factory to create and track spice auction contracts |
|   6   | contracts/templegold/TempleGold.sol |  162   | Temple Gold is a non-transferrable ERC20 token with LayerZero integration for cross-chain transfer for holders. On mint, Temple Gold is distributed to DaiGoldAuction, Staking contracts and team multisig using distribution share parameters percentages set at `DistributionParams`. Users can get Temple Gold by staking Temple for Temple Gold rewards on the staking contract or in auctions. |
|   7   | contracts/templegold/TempleGoldAdmin.sol |  50   | Temple Gold Admin is an admin to Temple Gold contract. From the setup of layerzero, `Ownable` is used for admin executions. Avoids a manual import to change `Ownable` to `ElevatedAccess` by using this contract for admin executions |
|   8   | contracts/templegold/TempleGoldStaking.sol |  334   | Stakers deposit Temple and claim rewards in Temple Gold. This is a fork of the synthetix staking contract with some modifications (voting function, vested rewards and flexible reward durations). Duration for distributing staking rewards is set with `setRewardDuration`. A vesting period is used to encourage longer staking time. Governance contracts will read a staker's vote power with `getCurrentVotes` and `getPriorVotes`. |
|   9   | contracts/templegold/TempleTeleporter.sol |  38   |  Temple Teleporter transfers Temple token cross-chain with layer zero integration |
|     |  |  998   |  |


### Not in Scope
- Any findings from previous audits are out of scope
    - TempleGold - [Cyfrin audit](https://github.com/Cyfrin/cyfrin-audit-reports/blob/main/reports/2024-06-17-cyfrin-templedao-v2.1.pdf)

- ERC20 Tokens:
    - Non standard 18dp ERC20 Tokens (eg USDT, other fee taking ERC20s) and USDC are out of scope

- Any `slither` output is considered public and out of scope
    - slither output: [protocol/slither.db.json](https://github.com/TempleDAO/temple/blob/templegold/protocol/slither.db.json)

- Centralization risks are for policy/emergency/operational behaviour, and owned by the TempleDAO multisig. This is acceptable and out of scope as it's required for the protocol to work as intended and protect user funds

- External libraries (prbmath, openzeppelin, layerszerolabs) are out of scope.

## Compatibilities

Please outline specific compatibilities of the protocol ie. blockchains (All EVM Compatible, specific chains). Please also include specific tokens, referencing standard contracts/interfaces when necessary, that are expected to function with the protocol. Include all whitelisted, or blacklisted tokens which are or are not supported. If the protocol is expected to function with **any** chain compatible tokens, please specify this.

```
Compatibilities:
  Blockchains:
      - Ethereum/Any EVM
  Tokens:
      - DAI
      - ENA
      - Temple
```

## Setup

Please outline specific steps/processes to be followed in order for an auditor to run the project off a local clone of the contest repo. Please again be detailed and thorough, including specific markdowned CLI commands and necessary .env adjustments.

Please also include steps needed to run appropriate tests included in scope.

Requirements:
- [Yarn](https://classic.yarnpkg.com/lang/en)
- [NVM](https://github.com/nvm-sh/nvm)
- [Foundry](https://book.getfoundry.sh/getting-started/installation)

Node:
```bash
# use node version > 18
# Example
nvm use 20.0.0
```

Setup:
```bash
# clone repository
git clone git@github.com:TempleDAO/temple.git
cd temple/protocol
# switch branch
git checkout templegold
# install dependencies
yarn install
```

Build:
```bash
# install forge dependencies
forge install

forge build
```

Tests:
```bash
# match contract
forge test --mc TempleGoldStaking
```

## Known Issues

Known Issues:
- Dai-Gold auction might not get started for last mint of gold tokens - 
Usually minting gold happens when the available amount is bigger than 1e4, which will configure the minimum distribution amount of DaiGoldAuction. However when it reaches the max supply, the minting amount can be smaller than minimum amount, thus DaiGoldAuction might not get started because the amount will be smaller than the minimum distribution amount.
For the last mint (leading to max supply), config.auctionMinimumDistributedGold will be updated to prevent this.

- In Temple Gold contract, setDistributionParams() can be executed with 0 value for a parameter eg. params.gnosis -
This is intentional to freely distribute minted TGLD to staking and dai gold auction only.

- Support for fee-on transfer tokens in spice auctions -
We do not expect to have spice tokens with fee on transfer. This is checked in contract nonetheless.

- Distribution starter is a trusted role

- Staking rewards for last epoch might not be distributed if remaining rewards are less than reward duration (dust amount) -
Dust amounts which are rewards less than reward duration for the last epoch will not be distributed. 
This is from L190 in `TempleGoldStaking.sol`.
```solidity
if (rewardAmount < rewardDuration ) { revert CommonEventsAndErrors.ExpectedNonZero(); }
```
We will redirect enough TGLD to staking for the last distribution.

- Current design of TempleGold prevents distribution of tokens -
With current TempleGold token design, tokens only can be transferred to/from whitelisted addresses. This prevents further distribution of TempleGold tokens where they could be listed on DEXes, put on lending pro- tocols as collateral and so on.
This is intended to make TGLD non-tradable.

- TempleGold incompatibility with some chains -
Because of PUSH0 not supported in `0.8.19` or lower versions of solidity compiler, TempleGold will be
incompatible with chains like Linea where it only supports solidity compiler 0.8.19 or lower.
