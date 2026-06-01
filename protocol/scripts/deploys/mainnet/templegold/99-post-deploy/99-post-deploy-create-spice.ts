import '@nomiclabs/hardhat-ethers';
import { run } from 'hardhat';
import {
  runAsyncMain,
  mine,
} from '../../../helpers';
import { getDeployContext } from '../deploy-context';

async function main() {
    const { INSTANCES } = await getDeployContext(__dirname);
    
    const name = "[TGLD]/[ENA]";
    const spiceToken = "0x57e114b691db790c35207b2e685d4a43181e6061"; // ENA

    if(!name || !spiceToken) { throw new Error("Missing name or spice token!"); }

    await mine(INSTANCES.TEMPLE_GOLD.SPICE_AUCTION_FACTORY.createAuction(spiceToken, name));
    const spiceAuction = await INSTANCES.TEMPLE_GOLD.SPICE_AUCTION_FACTORY.findAuctionForSpiceToken(spiceToken);
    
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

runAsyncMain(main);
