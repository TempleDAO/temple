import '@nomiclabs/hardhat-ethers';
import '@nomiclabs/hardhat-etherscan';
import { ethers, run } from 'hardhat';
import {
  ensureExpectedEnvvars,
  mine,
  toAtto
} from '../../helpers';
import {
    getDeployedTempleGoldContracts,
    connectToContracts,
    ContractInstances
} from '../../mainnet/templegold/contract-addresses';
import { SpiceAuction, SpiceAuction__factory } from '../../../../typechain';

async function main() {
    ensureExpectedEnvvars();
    const [owner] = await ethers.getSigners();
    const ownerAddress = await owner.getAddress();
    const TEMPLEGOLD_ADDRESSES = getDeployedTempleGoldContracts();

    const TEMPLE_GOLD_INSTANCES = connectToContracts(owner);
    const name = "TGLD_DAI_SPICE"; // eg. "TGLD_TOKENNAME_SPICE";
    const spiceToken = TEMPLEGOLD_ADDRESSES.EXTERNAL.MAKER_DAO.DAI_TOKEN;

    if(!name || !spiceToken) { throw new Error("Missing name or spice token!"); }

    await mine(TEMPLE_GOLD_INSTANCES.TEMPLE_GOLD.SPICE_AUCTION_FACTORY.createAuction(spiceToken, name));
    const spiceAuction = await TEMPLE_GOLD_INSTANCES.TEMPLE_GOLD.SPICE_AUCTION_FACTORY.findAuctionForSpiceToken(spiceToken);
    
    // If etherscan knows the contract bytecode, it may already have automatically been verified.
    try {
        await run("verify:verify", {
            address: spiceAuction,
            constructorArguments: [],
        });
    } catch {
        console.log(`Spice auction contract already verified: ${spiceAuction}`);
    }
   

    // Comment out both lines below if want to fund auction immediately
    // Otherwise run them one after the next.
    const spiceInstance = SpiceAuction__factory.connect(spiceAuction, owner);
    await _setAuctionConfig(ownerAddress, spiceInstance);
    await _fundAuction(TEMPLE_GOLD_INSTANCES, spiceInstance);
}

async function _setAuctionConfig(ownerAddress: string, spiceInstance: SpiceAuction) {
    const config = {
        duration: 3600 * 24 * 7,
        waitPeriod: 60,
        minimumDistributedAuctionToken: ethers.utils.parseEther("1000"),
        isTempleGoldAuctionToken: false,
        recipient: ownerAddress
    }
    await mine(spiceInstance.setAuctionConfig(config));
}

async function _fundAuction(instances: ContractInstances, spiceInstance: SpiceAuction) {
    const amount = toAtto(50_000);
    // approve spend
    await mine(instances.EXTERNAL.MAKER_DAO.DAI_TOKEN.approve(spiceInstance.address, amount));
    const now = (new Date()).getTime();
    const startTime = Math.floor((now / 1000) +  3 * 60 * 60);
 
    await mine(spiceInstance.fundNextAuction(amount, startTime));
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });