# TEMPLE GOLD (TGLD)

## Temple Gold Token

Section here talks about technicals on Temple Gold.

### Minting
Amount of tokens to be minted are accrued per seconds depending on a vesting schedule. `mint()` is a public function and is called, executed and tokens distributed if accrued tokens are more than `MINIMUM_MINT`.
Some actions on staking and auctions contracts trigger a call to `mint()`.
Minting is only done on the source chain Arbitrum One.


## Staking
Templars stake Temple tokens for Temple Gold rewards. An IOU is issued to stakers at an equal amount of staked Temple amount at a 1:1 ratio. The IOU token is `StakedVoteToken`. This token can be locked and used for participation in governance voting. Stakers can also delegate their votes to deleagates using the `VoteDelegate` contract.

## Auctions

### DaiGold Auctions
In DaiGold auctions, anyone can bid DAI in exchange for Temple Gold. This Temple Gold tokens are distributed prior to auction starting. Tokens distributed for the epoch are distributed after auction per Dai token deposited.

### Spice Auctions
In a spice auction, a volatile token is bid for Temple Gold or vice versa.
The Layer Zero integration allows Temple Gold (TGLD) usage in spice bazaar auctions cross-chain.

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