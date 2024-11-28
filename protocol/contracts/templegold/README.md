# TEMPLE GOLD (TGLD)

## Background

Temple Gold (TGLD) is non-transferrable ERC-20 token that serves as “points” that can only interact with whitelisted contracts
- Staking
- Auctions Escrow
- Team Gnosis
- Spice Bazaar Auctions Contract(s)
Which means TGLD tokens can be sent to staking and auction contracts as staking rewards and as auction rewards.
The mint source chain of Temple Gold is `Arbitrum One`. With layer zero integration, Temple Gold can be transferred cross-chain. A holder can only transfer cross-chain to their own address.


## High level design
![High level design](docs/high-level.jpeg)

## Temple Gold Token (TGLD)

Section here talks about technicals on Temple Gold.


### Admin

Temple Gold (TGLD) extends layer zero's `OFT` contracts, which depend on Open Zeppelin's (OZ) `Ownable`. Temple contracts are controlled with `TempleElevatedAccess`, which is a more flexible upgrade to `Ownable`. To avoid manual changes to imported Layer Zero contracts, Temple Gold is controlled by `TempleGoldAdmin` which uses `TempleElevatedAccess`

### Constants

TGLD has the below constant values. When `mint()` is called, distribution happens only when mint amount is greater than `MINIMUM_MINT`

```solidity
//// @notice Distribution as a percentage of 100
uint256 public constant DISTRIBUTION_DIVISOR = 100 ether;
/// @notice 1B max supply
uint256 public constant MAX_CIRCULATING_SUPPLY = 1_000_000_000 ether; // 1B
/// @notice Minimum Temple Gold minted per call to mint
uint256 public constant MINIMUM_MINT = 10_000 ether;
```

### Minting

Amount of tokens to mint are accrued per second depending on a vesting schedule. The vesting schedule (factor) is set using function `setVestingFactor(VestingFactor calldata _factor)`. 

```solidity
struct VestingFactor {
    /// @notice Value of vesting factor. Typically 35
    uint128 value;
    /// @notice Week multiplier. Typically 1 week
    uint128 weekMultiplier;
}

```

`mint()` is a public function when called, tokens  are distributed according to the vesting factor, if accrued tokens at current time are more than `MINIMUM_MINT`.
`distributeGold()` in TempleGoldStaking and DaiGoldAuction contracts also call `mint()`.

Minting is only done on the source chain Arbitrum One.
Minted tokens are distributed to staking, DaiGold auction contract and team gnosis depending on the set distribution parameters. Distribution parameters are set with `setDistributionParameters()` by admin.


## Staking

Templars stake Temple tokens for Temple Gold rewards.
Temple can be transferred cross-chain to Arbitrum One using the `TempleTeleporter` contract. Temple tokens are burned on mainnet and same amount of tokens are minted on arbitrum one.

Staking contract has voting capabilities built in.
When a user stakes or withdraws, their delegate's vote is updated. A staker participating in governance must set delegate to either own address or another address using `delegate()`. Setting delegate to address zero means no participation in governance(default). A user can set delegate (to self or another address) before or after staking. The plan for UI flow is to let stakers set delegate first if they want to do governance voting.

Migration is built in, if there is an upgrade to staking contract. First, `setMigrator()` is called. Migrator is the next staking contract. Migrator calls `migrateWithdraw()` to withdraw and migrate staker's stake amount and optionally claim rewards.
Rewards can be claimed after migration.

Staking contract will also be deployed to Arbitrum One chain.

Staking contract has unstake cooldown feature. This means cooldown time after staking, before staker can unstake.

## Auctions

### DaiGold Auctions
In DaiGold auctions, bidders bid DAI in exchange for Temple Gold when an auction is active. These Temple Gold tokens available for each auction are sent to `DaiGoldAuction` contract prior to auction starting. 

`TempleGold.mint()` distributes TGLD tokens on mint to DaiGoldAuction, Staking contracts and team multisig using distribution share parameters percentages set at `DistributionParams`. 
Temple Gold reward tokens for each auction are shared amongst DAI bidders/depositors after the auction has ended. DAI depositors can claim their share of the TGOLD rewards after auction and also retroactively.

A `DaiGold` auction has the following configuration options.
```solidity
    struct AuctionConfig {
        /// @notice Time diff between two auctions. Usually 2 weeks
        uint32 auctionsTimeDiff;
        /// @notice Cooldown after auction start is triggered, to allow deposits
        uint32 auctionStartCooldown;
        /// @notice Minimum Gold distributed to enable auction start
        uint192 auctionMinimumDistributedGold;
    }
```

Bid token can be updated later using `setBidToken`. It can be assumed that the bid token has no funky internal taxes or fees, callbacks or complex functionalities beyond the usual OZ ERC20 functions.

Each auction lasts for 1 week. Proceeds from auctions are sent directly to treasury.

#### Constants

```solidity
/// @notice Auction duration
uint64 public constant AUCTION_DURATION = 1 weeks;
```

### Spice Auctions

In a spice auction, a "spice" token is bid for Temple Gold or vice versa. Each spice auction epoch has a different configuration.
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
    /// @notice Auction proceeds recipient
    address recipient;
}

```
Spice auction configuration are set and controlled by the DAO executor (part of the governance process).
Each spice auction contract is configured with one spice token and templegold. Spice auction contracts are deployed via `SpiceAuctionFactory`.

The Layer Zero integration allows Temple Gold (TGLD) usage in spice bazaar auctions cross-chain.

After a spice auction (epoch), `burnAndNotify()` is called to perform a call to `TempleGold` to burn and update the circulating supply. `TempleGold.circulatingSupply()` on source chain Arbitrum One is the actual circulating supply.

#### Constants
```solidity
/// @notice Auctions run for minimum 1 week
uint32 public constant MINIMUM_AUCTION_PERIOD = 1 weeks;
/// @notice Maximum wait period between last and next auctions
uint32 public constant MAXIMUM_AUCTION_WAIT_PERIOD = 90 days;
/// @notice Maximum auction duration
uint32 public constant MAXIMUM_AUCTION_DURATION = 30 days;

```

## Layer Zero Interactions

Minting of Temple Gold tokens happens on arbitrum. This is the source chain. Minted Temple Gold tokens are transferred to Staking, DaiGold auction contract and gnosis team multisig according to set configuration percentages. Staking and DaiGold contracts are both deployed on arbitrum.

Majority of Temple is on Ethereum mainnet. Gas prices are expected to rise in the coming months. Temple is staked for TGLD rewards on staking contract which is on arbitrum. We introduce `TempleTeleporter` contract with layer zero integration to for templars to `teleport` Temple tokens from mainnet to arbitrum in one transaction with no bridging. 
`TempleTeleporter` burns temple tokens on Ethereum mainnet and mints the same amount on Arbitrum One to a destination address. Usually the destination address is the same as source address, that is, `teleporting` Temple tokens between chains.

DaiGold auctions also are on arbitrum. Users can easily move Dai tokens from mainnet to arbitrum using [Stargate finance](https://stargate.finance/) in a single transaction with no bridging.

The Layer Zero integration allows Temple Gold (TGLD) usage in future spice bazaar auctions cross-chain. Volatile tokens can be bid for Temple Gold or vice versa in an auction. Volatile tokens can have any source chain. TGLD can be transferred cross-chain for spice auctions.

<ins>A summary of interactions:</ins>
- Minting on Arbitrum and distributed to staking contract, gnosis team wallet and DaiGold auction contract.
- Users staking teleport Temple tokens from mainnet to arbitrum using `TempleTeleporter`
- Users unstaking teleport unstaked Temple tokens from arbitrum to mainnet using `TempleTeleporter`
- Auction participants transfer Dai to arbitrum using [Stargate finance](https://stargate.finance/)
- Reverse spice bazaar auctions (bidding TGLD for volatile token) can be on any chain. Layer zero integration allows transferring TGLD cross-chain to participate in reverse spice bazaar auctions