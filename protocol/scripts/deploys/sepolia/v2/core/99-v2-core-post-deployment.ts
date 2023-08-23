import { ethers } from 'hardhat';
import {
    ensureExpectedEnvvars,
    mine
} from '../../../helpers';
import { 
    connectToContracts,
    getDeployedContracts,
} from '../contract-addresses';
import { ITempleStrategy } from '../../../../../typechain';

async function main() {
    ensureExpectedEnvvars();
  
    const [owner] = await ethers.getSigners();
    const TEMPLE_V2_ADDRESSES = getDeployedContracts();
    const TEMPLE_V2_INSTANCES = connectToContracts(owner);

    // TESTNET ONLY -- Allow msig & owner to mint Testnet Temple
    {
        await mine(TEMPLE_V2_INSTANCES.CORE.TEMPLE_TOKEN.addMinter(TEMPLE_V2_ADDRESSES.CORE.EXECUTOR_MSIG));       
        await mine(TEMPLE_V2_INSTANCES.CORE.TEMPLE_TOKEN.addMinter(await owner.getAddress()));
    }

    // Setup Temple => dTemple & base strategy
    {   
        // TRV can mint/burn $dTEMPLE
        await mine(TEMPLE_V2_INSTANCES.TREASURY_RESERVES_VAULT.D_TEMPLE_TOKEN.addMinter(TEMPLE_V2_ADDRESSES.TREASURY_RESERVES_VAULT.ADDRESS));

        // Temple base strategy & multisig can mint/burn $TEMPLE
        await mine(TEMPLE_V2_INSTANCES.CORE.TEMPLE_TOKEN.addMinter(TEMPLE_V2_ADDRESSES.STRATEGIES.TEMPLE_BASE_STRATEGY.ADDRESS));

        // temple -> dTemple
        await mine(TEMPLE_V2_INSTANCES.TREASURY_RESERVES_VAULT.INSTANCE.setBorrowToken(
            TEMPLE_V2_ADDRESSES.CORE.TEMPLE_TOKEN,
            TEMPLE_V2_ADDRESSES.STRATEGIES.TEMPLE_BASE_STRATEGY.ADDRESS,
            ethers.utils.parseEther("200000"), // 0.2mm
            ethers.utils.parseEther("200000"), // 0.2mm
            TEMPLE_V2_ADDRESSES.TREASURY_RESERVES_VAULT.D_TEMPLE_TOKEN
        ));

        const debtCeiling: ITempleStrategy.AssetBalanceStruct[] = [{
            asset: TEMPLE_V2_ADDRESSES.CORE.TEMPLE_TOKEN,
            balance: ethers.utils.parseEther("5000000") // 5mm
        }];

        await mine(TEMPLE_V2_INSTANCES.TREASURY_RESERVES_VAULT.INSTANCE.addStrategy(
            TEMPLE_V2_ADDRESSES.STRATEGIES.TEMPLE_BASE_STRATEGY.ADDRESS,
            0, // underperformingEquityThreeshold
            debtCeiling
        ));
    }

    // Setup DAI => dUSD & DSR strategy
    {   
        // TRV can mint/burn dUsd
        await mine(TEMPLE_V2_INSTANCES.TREASURY_RESERVES_VAULT.D_USD_TOKEN.addMinter(TEMPLE_V2_ADDRESSES.TREASURY_RESERVES_VAULT.ADDRESS));

        // dai -> dUsd
        await mine(TEMPLE_V2_INSTANCES.TREASURY_RESERVES_VAULT.INSTANCE.setBorrowToken(
            TEMPLE_V2_ADDRESSES.EXTERNAL.MAKER_DAO.DAI_TOKEN,
            TEMPLE_V2_ADDRESSES.STRATEGIES.DSR_BASE_STRATEGY.ADDRESS,
            ethers.utils.parseEther("200000"), // 0.2mm
            ethers.utils.parseEther("200000"), // 0.2mm
            TEMPLE_V2_ADDRESSES.TREASURY_RESERVES_VAULT.D_USD_TOKEN
        ));

        const debtCeiling: ITempleStrategy.AssetBalanceStruct[] = [{
            asset: TEMPLE_V2_ADDRESSES.EXTERNAL.MAKER_DAO.DAI_TOKEN,
            balance: ethers.utils.parseEther("30000000") // 30mm
        }];

        await mine(TEMPLE_V2_INSTANCES.TREASURY_RESERVES_VAULT.INSTANCE.addStrategy(
            TEMPLE_V2_ADDRESSES.STRATEGIES.DSR_BASE_STRATEGY.ADDRESS,
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