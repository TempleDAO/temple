import { ethers, network } from 'hardhat';
import {
    ensureExpectedEnvvars,
    mine
} from '../../helpers';
import { TempleERC20Token__factory, TestnetRelic__factory } from '../../../../typechain';
import { DEPLOYED_CONTRACTS } from '../../helpers';

async function main() {
    ensureExpectedEnvvars();
  
    const [owner] = await ethers.getSigners();
    const deployedContracts = DEPLOYED_CONTRACTS[network.name];
    const relic = TestnetRelic__factory.connect(deployedContracts.RELIC, owner);
    const temple = TempleERC20Token__factory.connect(deployedContracts.TEMPLE, owner);
    
        
    const ownerAddress = await owner.getAddress();

    // TESTNET ONLY -- Allow owner to mint Testnet Temple
    {     
        await mine(temple.addMinter(ownerAddress));
    }

    // Setup relic minters
    {   
        await mine(relic.setRelicMinter(ownerAddress, true));
        await mine(relic.setRelicMinter(deployedContracts.TEMPLE_SACRIFICE, true));
    }
    // XP controllers
    {
        await mine(relic.setXPController(ownerAddress, true));
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