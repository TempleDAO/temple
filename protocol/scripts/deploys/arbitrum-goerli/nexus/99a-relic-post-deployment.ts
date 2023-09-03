import { ethers, network } from 'hardhat';
import {
    ensureExpectedEnvvars,
    mine
} from '../../helpers';
import { 
    connectToContracts,
    getDeployedContracts,
} from '../../v2/sepolia/contract-addresses';
import { TestnetRelic__factory } from '../../../../typechain';
import { DEPLOYED_CONTRACTS } from '../../helpers';

async function main() {
    ensureExpectedEnvvars();
  
    const [owner] = await ethers.getSigners();
    const TEMPLE_V2_DEPLOYED = getDeployedContracts();
    const templeV2contracts = connectToContracts(owner);
    const deployedContracts = DEPLOYED_CONTRACTS[network.name];
    const relic = TestnetRelic__factory.connect(deployedContracts.RELIC, owner);
    
        
    const ownerAddress = await owner.getAddress();

    // TESTNET ONLY -- Allow msig & owner to mint Testnet Temple
    {
        // await mine(templeV2contracts.templeToken.addMinter(TEMPLE_V2_DEPLOYED.CORE.EXECUTOR_MSIG));       
        await mine(templeV2contracts.templeToken.addMinter(ownerAddress));
    }

    // Setup relic minters
    {   
        await mine(relic.setRelicMinter(ownerAddress, true));
        await mine(relic.setRelicMinter(TEMPLE_V2_DEPLOYED.CORE.EXECUTOR_MSIG, true));
    }
    // XP controllers
    {
        await mine(relic.setXPController(ownerAddress, true));
        await mine(relic.setXPController(TEMPLE_V2_DEPLOYED.CORE.EXECUTOR_MSIG, true));
    }
    // shard
    {
        await mine(relic.setShard(deployedContracts.SHARD));
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