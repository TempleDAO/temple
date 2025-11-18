import '@nomicfoundation/hardhat-verify';
import { ethers, run } from 'hardhat';
import {
  ensureExpectedEnvvars,
  mine
} from '../../helpers';
import {
    connectToContracts
} from '../../mainnet/templegold/contract-addresses';

async function main() {
    ensureExpectedEnvvars();
    const [owner] = await ethers.getSigners();

    const TEMPLE_GOLD_INSTANCES = connectToContracts(owner);
    const name = "[TGLD]/[ENA]";
    const spiceToken = "0x57e114b691db790c35207b2e685d4a43181e6061"; // ENA

    if(!name || !spiceToken) { throw new Error("Missing name or spice token!"); }

    await mine(TEMPLE_GOLD_INSTANCES.TEMPLE_GOLD.SPICE_AUCTION_FACTORY.createAuction(spiceToken, name));
    const spiceAuction = await TEMPLE_GOLD_INSTANCES.TEMPLE_GOLD.SPICE_AUCTION_FACTORY.findAuctionForSpiceToken(spiceToken);
    
    // If etherscan knows the contract bytecode, it may already have automatically been verified.
    try {
        await run("verify:verify", {
            address: spiceAuction,
            constructorArguments: [],
        });
    } catch (error: any) {
        if (error.message?.toLowerCase().includes('already verified')) {
            console.log(`Spice auction contract already verified: ${spiceAuction}`);
        } else {
            console.error(`Verification failed: ${error.message}`);
            throw error;
        }
    }

    // Comment out lines below if want to find spice auction contract address
    // const spiceInstance = SpiceAuction__factory.connect(spiceAuction, owner);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });