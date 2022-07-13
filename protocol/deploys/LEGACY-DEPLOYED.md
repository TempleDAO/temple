# Legacy Deployed Contracts

Contracts deployed no longer used by temple. Tracked for posterity

## On Mainnet

### Fire Ritual

#### [SandalwoodToken](https://etherscan.io/address/0x4FA80013F5d13DB10f2c5DC2987081cb48c7c069)

Originally temple was concived as a multi-token system. This complexity was scrapped pre-launch. The token
is a simple fixed supply ERC20 which was bridged to [polygon](https://polygonscan.com/address/0xe99e95ec6DCae4c85806F13CDf1351aE0FEf55Be)
as well (where we planned on tracking and rewarding users as they progressed through the game, given the low gas costs)

#### [PresaleAllocation](https://etherscan.io/address/0x6cf2A119f98A4B4A7FA4Fd08A1E72D7aF3ba72FE)

Allocation for various templars during the fire ritual. Purely on chain informational as to who got what

#### [Presale](https://etherscan.io/address/0xDC9D4685847f1C8bDd4CE86BE6A83Fa09B6A08b1)

Manage fireritual presale. Templars could swap Frax for Temple, up to their allocation as specificed in
[PresaleAllocation](https://etherscan.io/address/0x6cf2A119f98A4B4A7FA4Fd08A1E72D7aF3ba72FE).

### Opening Ceremony

#### [OpeningCeremony](https://etherscan.io/address/0xA2642dF0139faeBB1D45526a46d5c54B805Be02c)

Part of temple's fair launch presale. Gated by a metaverse experience/game and rate limited as to how much
any given wallet can buy per day.

#### [OpeningCeremonyVerifier](https://etherscan.io/address/0x8ed9a9980E4C7e87eDf8DA13Fc2ba53802BBa117)

On completion of the OC game, templars had to 'burn their incense' (aka verify). This contract took
an appropriately signed requested from a templar and added them as a verified OC participant

#### [OpeningCeremonyQuest](https://polygonscan.com/address/0x17d723436740F2852274192dA27F65116ECd011E)

On chain tracked progress through the OC game. On completion, templars could hit an API call which checked
polygon for completion, and if so, issued users with a signed request they could then take to mainnet, verify
and buy temple

#### [TempleCashback](https://etherscan.io/address/0x72e9fa8eD38ddbdA4b044E95A206EDaA509FdF72)

Yeild that was communicated to fire rituatlists was a bit less than the yield paid. This contract topped them up.

### Temple V1 Mechanics

#### [TempleStaking](https://etherscan.io/address/0x4D14b24EDb751221B3Ff08BBB8bd91D4b1c8bc77)

This, along with [OGTemple](https://etherscan.io/address/0x654590f810f01b51dc7b86915d4632977e49ea33) was
how the DAO paid out temple yeild, auto-compounding to stakers.

#### [LockedOGTemple](https://etherscan.io/address/0x879B843868dA248B1F2F53b4f8CC6e17e7E8b949)

All temple bought in the fire ritual and opening ceremony was auto staked and locked. This contract managed
the various locks per templar.

#### [TempleTreasury](https://etherscan.io/address/0x22c2fE05f55F81Bf32310acD9a7C51c4d7b4e443)

During Fire ritual and OC, this is where all treasury frax was deposited, and is the mechanic by which we
ran safe harvest to generate DAO temple used to pay yeilds, allocate DAO funds, setup LP etc.

As the product evolved, it was clear we needed flexibility over treasury and we migrated completely
to various gnosis multisigs.

#### TreasuryManagementProxy

  - Deploy with wrong owner https://etherscan.io/address/0xb18F07b22845dF936310B63bdD04ce0E28e78C6F
  - Deploy with correct owner (but ultimately unused) https://etherscan.io/address/0x20bEB455c3b7b0D84091b84c25f51Bc002d92f05

Plan was to automate harvest, to do so we need to remove ACL on harvest, but keep ACL on remaining treasury operations. Contract
was deployed twice, first was deployed with the wrong owner (needed to be the DAO Multisig). In the end, neither was used
as we migrated away from the v1 Treasury.

#### Exit Queue

Original intent was to rate limit exits from staking. 4 versions were deployed

  - Original https://etherscan.io/address/0xfaeadcd9cb6870a5df09e403e4dcfcf1a6f20a0c
  - Auto-burn temple from certain wallets to account for an over-purchase during OC: 
    https://etherscan.io/address/0x967591888A5e8aED9D2A920fE4cC726e83d2bca9
  - Accelerated exit queue post AMM launch/user unlock to speed up price discovery during the yeilding tokens
    crypto crash: https://etherscan.io/address/0xC6d556C34a179a224AEBE42e77c6e76594148B97
  - Simplified instant version, used to allow legacy stakers to zap into Temple Core Vaults https://etherscan.io/address/0x1F667edf04D8ABF8409Bf579a3F1bBf8ec263a85,

### Temple Custom AMM

#### [Faith](https://etherscan.io/address/0x22c2fE05f55F81Bf32310acD9a7C51c4d7b4e443)

Post AMM launch, to encourage hodl while we built out the games/mechanics to provide temple price support,
we rewarded templars who didn't sell with faith. This has since been used to give templars a bonus
during the vault launch phase.

#### [FaithAirdrop](https://etherscan.io/address/0x1b44a9a94f2bb14eeF0ded2f0428231e358d31d7)

Merkle tree airdrop for Faith.

### Temple AMM

#### [TempleFraxAMMRouter](https://etherscan.io/address/0x8A5058100E60e8F7C42305eb505B12785bbA3BcA)

Original deployed router, only allowed swapping between frax/temple with an IV floor and
protocol mint if the price increased. Replaced by a simpler router that still has an IV floor, 
but allows trading in both Fei and FRAX, and no protocol mint

#### [AMMWhitelist] https://etherscan.io/address/0x3fAEb34Ab68709DCa02D6B48A03256317b338896

Original launch required templars to complete a simple ritual before they had access to the AMM. This
contract captured that whitelist in a similar fashion to how the OC verification worked

#### [TempleFraxAMMOps](https://etherscan.io/address/0xc8c3C72d667196bAd40dE3e5eaDC29E74431257B)

Intent was to manage changing liquidity and raising IV as we minted on protocol. Given market
conditions, this level of automation wasn't required, as a result currently unused

#### [TempleIVSwap](https://etherscan.io/address/0xb0D978C8Be39C119922B99f483cD8C4092f0EA56)

Original router had an issue whereby IV Floor only kicked in once a trade when below it.
This allowed arb bots to capture 'free profit', by buying whenever the price dipped below IV.

A quick fix for this was to split out IVSwap from the router, and let the frontend decide which
method to use to ensure users got the best price.

Deprecated, as the new router does this math correctly on chain
