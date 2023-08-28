import { ethers } from 'hardhat';
import {
    ensureExpectedEnvvars,
    mine
} from '../../helpers';
import { 
    connectToContracts,
    getDeployedContracts,
} from '../../v2/sepolia/contract-addresses';
import { ITempleStrategy } from '../../../../typechain';
import { TempleERC20Token__factory } from '../../../../typechain';
import { Relic__factory } from '../../../../typechain';
import { DEPLOYED_CONTRACTS } from '../../helpers';

async function main() {
    ensureExpectedEnvvars();
  
    const [owner] = await ethers.getSigners();
    const TEMPLE_V2_DEPLOYED = getDeployedContracts();
    const templeV2contracts = connectToContracts(owner);
    const templeToken = TempleERC20Token__factory.connect(TEMPLE_V2_DEPLOYED.CORE.TEMPLE_TOKEN, owner);
    // const relic = Relic__factory.connect(DEPLOYED_CONTRACTS.RELIC, owner);
    
        
    const ownerAddress = await owner.getAddress();

    // TESTNET ONLY -- Allow msig & owner to mint Testnet Temple
    {
        await mine(templeV2contracts.templeToken.addMinter(TEMPLE_V2_DEPLOYED.CORE.EXECUTOR_MSIG));       
        await mine(templeV2contracts.templeToken.addMinter(ownerAddress));
    }

    // Setup relic minters
    {   
        // await mine(relic.setRelicMinter(...))
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