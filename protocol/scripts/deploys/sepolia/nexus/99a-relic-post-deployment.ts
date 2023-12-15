import { ethers } from 'hardhat';
import {
    ensureExpectedEnvvars,
    mine
} from '../../helpers';
import { connectToContracts } from './contract-addresses';

async function main() {
    ensureExpectedEnvvars();
  
    const [owner] = await ethers.getSigners();
    const deployedContracts = connectToContracts(owner);
    const relic = deployedContracts.NEXUS.RELIC;
    const temple = deployedContracts.CORE.TEMPLE_TOKEN;    
        
    const ownerAddress = await owner.getAddress();

    // set shard
    await mine(relic.setShard(deployedContracts.NEXUS.SHARD.address));
    await mine(relic.setNexusCommon(deployedContracts.NEXUS.NEXUS_COMMON.address));

    // set Relic minter enclave IDs
    const enclaveIds = [1, 2, 3, 4, 5];
    const allow = [true, true, true, true, true];
    await mine(relic.setRelicMinterEnclaveIds(deployedContracts.NEXUS.TEMPLE_SACRIFICE.address, enclaveIds, allow));
    const zeroRarityUri = "ipfs://QmVBhkqq3qEeQvdCDWSXQGMX7hFDymZvy7X7J4z9GsUAB3/";
    await mine(relic.setBaseUriRarity(0, zeroRarityUri));

    // TESTNET ONLY -- Allow owner to mint Testnet Temple
    {     
        await mine(temple.addMinter(ownerAddress));
    }
}
  
// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });