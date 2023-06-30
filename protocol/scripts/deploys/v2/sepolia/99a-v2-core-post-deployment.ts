import { ethers } from 'hardhat';
import {
    ensureExpectedEnvvars,
    mine
} from '../../helpers';
import { 
    connectToContracts,
    getDeployedContracts,
} from './contract-addresses';
import { ITempleStrategy } from '../../../../typechain';

async function main() {
    ensureExpectedEnvvars();
  
    const [owner] = await ethers.getSigners();
    const TEMPLE_V2_DEPLOYED = getDeployedContracts();
    const templeV2contracts = connectToContracts(owner);

    // TESTNET ONLY -- Allow msig & owner to mint Testnet Temple
    {
        await mine(templeV2contracts.templeToken.addMinter(TEMPLE_V2_DEPLOYED.CORE.EXECUTOR_MSIG));       
        await mine(templeV2contracts.templeToken.addMinter(await owner.getAddress()));
    }

    // Setup Temple => dTemple & base strategy
    {   
        // TRV can mint/burn $dTEMPLE
        await mine(templeV2contracts.dtemple.addMinter(TEMPLE_V2_DEPLOYED.TREASURY_RESERVES_VAULT.ADDRESS));

        // Temple base strategy & multisig can mint/burn $TEMPLE
        await mine(templeV2contracts.templeToken.addMinter(TEMPLE_V2_DEPLOYED.STRATEGIES.TEMPLE_BASE_STRATEGY.ADDRESS));

        const debtCeiling: ITempleStrategy.AssetBalanceStruct[] = [{
            asset: TEMPLE_V2_DEPLOYED.CORE.TEMPLE_TOKEN,
            balance: ethers.utils.parseEther("100000")
        }];

        await mine(templeV2contracts.trv.addStrategy(
            TEMPLE_V2_DEPLOYED.STRATEGIES.TEMPLE_BASE_STRATEGY.ADDRESS,
            0, // underperformingEquityThreeshold
            debtCeiling
        ));

        // temple -> dTemple
        await mine(templeV2contracts.trv.setBorrowToken(
            TEMPLE_V2_DEPLOYED.CORE.TEMPLE_TOKEN,
            TEMPLE_V2_DEPLOYED.STRATEGIES.TEMPLE_BASE_STRATEGY.ADDRESS,
            0,
            0,
            TEMPLE_V2_DEPLOYED.TREASURY_RESERVES_VAULT.D_TEMPLE_TOKEN
        ));
    }

    // Setup DAI => dUSD & DSR strategy
    {   
        // TRV can mint/burn dUsd
        await mine(templeV2contracts.dusd.addMinter(TEMPLE_V2_DEPLOYED.TREASURY_RESERVES_VAULT.ADDRESS));

        const debtCeiling: ITempleStrategy.AssetBalanceStruct[] = [{
            asset: TEMPLE_V2_DEPLOYED.EXTERNAL.MAKER_DAO.DAI_TOKEN,
            balance: ethers.utils.parseEther("100000")
        }];

        await mine(templeV2contracts.trv.addStrategy(
            TEMPLE_V2_DEPLOYED.STRATEGIES.DSR_BASE_STRATEGY.ADDRESS,
            0, // underperformingEquityThreeshold
            debtCeiling
        ));

        // dai -> dUsd
        await mine(templeV2contracts.trv.setBorrowToken(
            TEMPLE_V2_DEPLOYED.EXTERNAL.MAKER_DAO.DAI_TOKEN,
            TEMPLE_V2_DEPLOYED.STRATEGIES.DSR_BASE_STRATEGY.ADDRESS,
            ethers.utils.parseEther('10000'),
            ethers.utils.parseEther('10000'),
            TEMPLE_V2_DEPLOYED.TREASURY_RESERVES_VAULT.D_USD_TOKEN
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