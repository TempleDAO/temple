import { ethers, network } from 'hardhat';
import {
    ensureExpectedEnvvars,
    mine
} from '../../helpers';
import { TempleERC20Token__factory, Relic__factory } from '../../../../typechain';
import { DEPLOYED_CONTRACTS } from '../../helpers';

async function main() {
    ensureExpectedEnvvars();
  
    const [owner] = await ethers.getSigners();
    const deployedContracts = DEPLOYED_CONTRACTS[network.name];
    const relic = Relic__factory.connect(deployedContracts.RELIC, owner);
    const temple = TempleERC20Token__factory.connect(deployedContracts.TEMPLE, owner);
    
        
    const ownerAddress = await owner.getAddress();

    // set shard
    await mine(relic.setShard(deployedContracts.SHARD));
    await mine(relic.setNexusCommon(deployedContracts.NEXUS_COMMON));

    // set Relic minter enclave IDs
    const enclaveIds = [1, 2, 3, 4, 5];
    const allow = [true, true, true, true, true];
    await mine(relic.setRelicMinterEnclaveIds(deployedContracts.TEMPLE_SACRIFICE, enclaveIds, allow));
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