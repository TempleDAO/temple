import '@nomiclabs/hardhat-ethers';
import '@nomiclabs/hardhat-etherscan';
import { ethers, run } from 'hardhat';
import {
  ensureExpectedEnvvars,
  mine
} from '../../helpers';
import {
    getDeployedTempleGoldContracts,
    connectToContracts,
    ContractInstances
} from '../../mainnet/templegold/contract-addresses';

async function main() {
    ensureExpectedEnvvars();
    const [owner] = await ethers.getSigners();
    const ownerAddress = await owner.getAddress();
    const TEMPLEGOLD_ADDRESSES = getDeployedTempleGoldContracts();

    const TEMPLE_GOLD_INSTANCES = connectToContracts(owner);
    const name = ""; //"TGLD_TOKENNAME_SPICE";
    const spiceToken = "";

    if(!name || !spiceToken) { throw new Error("Missing name or spice token!"); }

    await mine(TEMPLE_GOLD_INSTANCES.TEMPLE_GOLD.SPICE_AUCTION_FACTORY.createAuction(spiceToken, name));
    const spiceAuction = await TEMPLE_GOLD_INSTANCES.TEMPLE_GOLD.SPICE_AUCTION_FACTORY.findAuctionForSpiceToken(spiceToken);
    
    await run("verify:verify", {
        address: spiceAuction,
        constructorArguments: [
            TEMPLEGOLD_ADDRESSES.TEMPLE_GOLD.TEMPLE_GOLD,
            spiceToken,
            ownerAddress,
            ownerAddress,
            40161,
            11155111,
            "TGLD_TEMPLE_SPICE_2"
        ],
    });

    // comment out both lines below and run immediately if `auctionConfig.startCooldown` is 0.
    // Otherwise run them one after the next.
    // await _setAuctionConfig(ownerAddress, TEMPLE_GOLD_INSTANCES);
    // await _startAuction(TEMPLE_GOLD_INSTANCES);
}

async function _setAuctionConfig(ownerAddress: string, instances: ContractInstances) {
    const config = {
        duration: 3600 * 24 * 7,
        waitPeriod: 60,
        startCooldown: 0,
        minimumDistributedAuctionToken: ethers.utils.parseEther("10000"),
        starter: ownerAddress,
        isTempleGoldAuctionToken: false,
        recipient: ownerAddress
    }
    await mine(instances.TEMPLE_GOLD.SPICE_AUCTION.setAuctionConfig(config));
}

async function _startAuction(instances: ContractInstances) {
    await mine(instances.TEMPLE_GOLD.SPICE_AUCTION.startAuction());
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });