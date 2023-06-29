import { ethers } from 'hardhat';
import {
    ensureExpectedEnvvars,
    mine,
} from '../../helpers';
import { connectToContracts, getDeployedContracts } from './contract-addresses';
import { ITempleStrategy } from '../../../../typechain';

async function main() {
    ensureExpectedEnvvars();
  
    const [owner] = await ethers.getSigners();
    const TEMPLE_V2_DEPLOYED = getDeployedContracts();
    const templeV2contracts = connectToContracts(owner);

    // Circuit breaker identifiers
    await mine(templeV2contracts.circuitBreakerProxy.setIdentifierForCaller(
        TEMPLE_V2_DEPLOYED.STRATEGIES.DSR_BASE_STRATEGY.ADDRESS,
        "EXTERNAL_USER"
    ));

    // Set DSR strategy
    {   
        const debtCeiling: ITempleStrategy.AssetBalanceStruct[] = [{
            asset: TEMPLE_V2_DEPLOYED.EXTERNAL.MAKER_DAO.DAI_TOKEN,
            balance: ethers.utils.parseEther("100000")
        }];

        await mine(templeV2contracts.trv.addStrategy(
            TEMPLE_V2_DEPLOYED.STRATEGIES.DSR_BASE_STRATEGY.ADDRESS,
            0, // underperformingEquityThreeshold
            debtCeiling
        ));
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