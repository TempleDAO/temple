import { ethers } from 'hardhat';
import {
    ensureExpectedEnvvars,
    impersonateSigner,
    mine,
    toAtto,
} from '../../helpers';
import { connectToContracts, ContractAddresses, ContractInstances, getDeployedTempleGoldContracts } from '../../mainnet/templegold/contract-addresses';
import { TempleGold__factory, TempleGoldStaking__factory, StableGoldAuction__factory, ISpiceAuction__factory, FakeERC20__factory } from '../../../../typechain';
import { EnforcedOptionParamStruct, TempleGold } from '../../../../typechain/contracts/templegold/TempleGold';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { BigNumberish } from 'ethers';


async function main() {
    ensureExpectedEnvvars();
    const [owner, recipient] = await ethers.getSigners();
    const TEMPLE_GOLD_ADDRESSES = getDeployedTempleGoldContracts();
    const TEMPLE_GOLD_INSTANCES = connectToContracts(owner);
    // signer 0
    const teamGnosis = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266';
    console.log(`OWNER ${await TEMPLE_GOLD_INSTANCES.TEMPLE_GOLD.TEMPLE_GOLD.owner()}`);
    console.log(`OWNER ${await TEMPLE_GOLD_INSTANCES.TEMPLE_GOLD.TEMPLE_GOLD_STAKING.executor()}`);
    const distributionParams = {
        staking: ethers.utils.parseEther("15"),
        auction: ethers.utils.parseEther("70"),
        gnosis: ethers.utils.parseEther("15")
    }
    const vestingFactor = {
        value: 35,
        weekMultiplier: 3600 * 24 * 7 // 1 week
    }
    ///// TEMPLE GOLD
    const templeGold = TempleGold__factory.connect(TEMPLE_GOLD_ADDRESSES.TEMPLE_GOLD.TEMPLE_GOLD, owner);
    const staking = TempleGoldStaking__factory.connect(TEMPLE_GOLD_ADDRESSES.TEMPLE_GOLD.TEMPLE_GOLD_STAKING, owner);
    const daiGoldAuction = StableGoldAuction__factory.connect(TEMPLE_GOLD_ADDRESSES.TEMPLE_GOLD.STABLE_GOLD_AUCTION, owner);
    // console.log(`TempleGold: ${staking.address}`);
    // // Set and whitelist contracts
    // await mine(templeGold.setTeamGnosis(teamGnosis));
    // await mine(templeGold.setStableGoldAuction(TEMPLE_GOLD_ADDRESSES.TEMPLE_GOLD.STABLE_GOLD_AUCTION));
    // await mine(templeGold.setStaking(TEMPLE_GOLD_ADDRESSES.TEMPLE_GOLD.TEMPLE_GOLD_STAKING));
    // await mine(templeGold.setVestingFactor(vestingFactor));
    // await mine(templeGold.setDistributionParams(distributionParams));
    // // // authorize contracts
    // await mine(templeGold.authorizeContract(TEMPLE_GOLD_ADDRESSES.TEMPLE_GOLD.STABLE_GOLD_AUCTION, true));
    // await mine(templeGold.authorizeContract(TEMPLE_GOLD_ADDRESSES.TEMPLE_GOLD.TEMPLE_GOLD_STAKING, true));
    // await mine(templeGold.authorizeContract(teamGnosis, true));

    // // // ///// Staking
    // const oneDay = 24 * 3600;
    // const duration = oneDay * 7; // 7 days
    // const unstakeCooldown = oneDay; // 1 day
    // const rewardsDistributionCooldown = 60; // 60 seconds
    // // reward duration
    // await mine(staking.setRewardDuration(duration));
    // // distribution starter
    // await mine(staking.setDistributionStarter(teamGnosis));
    // // rewards distribution cool down
    // await mine(staking.setRewardDistributionCoolDown(rewardsDistributionCooldown));
    // // // unstake cool down
    // await mine(staking.setUnstakeCooldown(unstakeCooldown));

    // // ////// DAI GOLD AUCTION
    // const auctionsTimeDiff = 60;
    // const auctionConfig = {
    //     /// Time diff between two auctions. Usually 2 weeks
    //     auctionsTimeDiff: auctionsTimeDiff,
    //     ///  Cooldown after auction start is triggered, to allow deposits
    //     auctionStartCooldown: 60,
    //     /// Minimum Gold distributed to enable auction start
    //     auctionMinimumDistributedGold: ethers.utils.parseEther("0.01"),
    // };
    // // // auction starter
    // await mine(daiGoldAuction.setAuctionStarter(teamGnosis));
    // // // auction config
    // await mine(daiGoldAuction.setAuctionConfig(auctionConfig));
    // // set enforced optons
    // await setEnforcedOptions(templeGold);
    // fund next auction
    // await fundNextAuction(TEMPLE_GOLD_INSTANCES, TEMPLE_GOLD_ADDRESSES, owner, recipient);
}

async function setEnforcedOptions(templeGold: TempleGold) {
    // set enforced options
     const options: EnforcedOptionParamStruct[] = [{
        eid: 30362, // berachain
        msgType: 1, // SEND
        options: "0x00030100110100000000000000000000000000030d40", // 200k gas limit
    }];
    await mine(templeGold.setEnforcedOptions(options))
}

async function fundNextAuction(
    INSTANCES: ContractInstances,
    ADDRS: ContractAddresses,
    owner: SignerWithAddress,
    recipient: SignerWithAddress
) {
    const spiceAuction = "0xBd90822a325c234881C0197B15e3f391f26F79Ef";
    const config = {
        duration: 604800,
        waitPeriod: 60,
        minimumDistributedAuctionToken: 10_000,
        isTempleGoldAuctionToken: false,
        recipient: await recipient.getAddress()
    }
    const spice = ISpiceAuction__factory.connect(spiceAuction, owner);
    // using owner instances
    // set config
    await mine(spice.setAuctionConfig(config));

    // approve tgld
    await mine(INSTANCES.TEMPLE_GOLD.TEMPLE_GOLD.approve(spiceAuction, toAtto(1_000_000)));

    // fund next auction
    const amount = toAtto(1_000);
    await fundDai(ADDRS.EXTERNAL.MAKER_DAO.DAI_TOKEN, await owner.getAddress(), amount);
    const startTime = Math.floor((new Date()).getTime()/1000) + 120; // 2 minutes from now
    await mine(INSTANCES.EXTERNAL.MAKER_DAO.DAI_TOKEN.approve(spiceAuction, toAtto(1_000_000)));
    await mine(spice.fundNextAuction(amount, startTime));

    // using recipient instances
    // recipient approves spice auction for redemption of TGLD
    const instances = connectToContracts(recipient);
    await mine(instances.EXTERNAL.MAKER_DAO.DAI_TOKEN.approve(spiceAuction, toAtto(1_000_000)));
}

async function fundDai(contract: string, recipient: string, amount: BigNumberish) {
    const daiWhaleAddress = "0x4C35234291Cb25676e5363cfF6f73f1eF545684b";
    const daiWhale = await impersonateSigner(daiWhaleAddress);
    const daiInstance = FakeERC20__factory.connect(contract, daiWhale);
    await mine(daiInstance.transfer(recipient, amount));
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });

