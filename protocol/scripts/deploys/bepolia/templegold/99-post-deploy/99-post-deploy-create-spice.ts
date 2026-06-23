import '@nomiclabs/hardhat-ethers';
import { run } from 'hardhat';
import {
  runAsyncMain,
  mine,
  toAtto
} from '../../../helpers';
import {
    ContractInstances
} from '../contract-addresses';
import { SpiceAuction, SpiceAuction__factory } from '../../../../../typechain';
import { DEFAULT_SETTINGS } from '../default-settings';
import { getDeployContext } from '../deploy-context';

async function main() {
    const { owner, ADDRS, INSTANCES } = await getDeployContext(__dirname);
    const ownerAddress = await owner.getAddress();

    const name = "TGLD_SPICE_SPICE"; // eg. "TGLD_TOKENNAME_SPICE";
    const spiceToken = ADDRS.TEMPLE_GOLD.SPICE_TOKEN;

    if(!name || !spiceToken) { throw new Error("Missing name or spice token!"); }

    // await mine(INSTANCES.TEMPLE_GOLD.SPICE_AUCTION_FACTORY.createAuction(spiceToken, name));
    const spiceAuction = await INSTANCES.TEMPLE_GOLD.SPICE_AUCTION_FACTORY.findAuctionForSpiceToken(spiceToken);
    
    // If etherscan knows the contract bytecode, it may already have automatically been verified.
    try {
        await run("verify:verify", {
            address: spiceAuction,
            constructorArguments: [],
        });
    } catch {
        console.log(`Spice auction contract already verified: ${spiceAuction}`);
    }

    // Comment out lines below if want to fund auction immediately
    // Otherwise run them one after the next.
    // const spiceInstance = SpiceAuction__factory.connect(spiceAuction, owner);
    // await _setAuctionConfig(ownerAddress, spiceInstance);
    // await _fundAuction(INSTANCES, spiceInstance);
}

async function _setAuctionConfig(ownerAddress: string, spiceInstance: SpiceAuction) {
    const config = {
        duration: DEFAULT_SETTINGS.SPICE.AUCTION.DURATION,
        waitPeriod: DEFAULT_SETTINGS.SPICE.AUCTION.WAIT_PERIOD,
        minimumDistributedAuctionToken: DEFAULT_SETTINGS.SPICE.AUCTION.MIN_DISTRIBUTED,
        isTempleGoldAuctionToken: false,
        recipient: ownerAddress
    }
    await mine(spiceInstance.setAuctionConfig(config));
}

async function _fundAuction(instances: ContractInstances, spiceInstance: SpiceAuction) {
    const amount = toAtto(50_000);
    // approve spend
    await mine(instances.TEMPLE_GOLD.SPICE_TOKEN!.approve(spiceInstance.address, amount));
    const now = (new Date()).getTime();
    const startTime = Math.floor((now / 1000) +  1 * 60 * 60); // 1 hour from now
 
    await mine(spiceInstance.fundNextAuction(amount, startTime));
}

runAsyncMain(main);
