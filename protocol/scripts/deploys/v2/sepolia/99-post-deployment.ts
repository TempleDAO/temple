import { ethers } from 'hardhat';
import {
    ensureExpectedEnvvars,
    mine,
} from '../../helpers';
import { connectToContracts, getDeployedContracts } from '../sepolia/contract-addresses';
import { keccak256 } from 'ethereumjs-util';
import { ITempleStrategy } from '../../../../typechain';

async function main() {
    ensureExpectedEnvvars();
  
    const [owner] = await ethers.getSigners();
    const TEMPLE_V2_DEPLOYED = getDeployedContracts();
    const templeV2contracts = connectToContracts(owner);
    const EXTERNAL_ALL_USERS  = keccak256(Buffer.from("EXTERNAL_USER"));

    // Setup Circuit Breaker for all users
    {
        await mine(templeV2contracts.circuitBreakerProxy.setIdentifierForCaller(owner.getAddress(), "EXTERNAL_USER"));

        // Circuit breaker for Temple
        await mine(templeV2contracts.circuitBreakerProxy.setCircuitBreaker(
            EXTERNAL_ALL_USERS,
            TEMPLE_V2_DEPLOYED.CORE.TEMPLE_TOKEN,
            TEMPLE_V2_DEPLOYED.CORE.CIRCUIT_BREAKER_PROXY
        ));

        // Circuit breaker for Dai
        await mine(templeV2contracts.circuitBreakerProxy.setCircuitBreaker(
            EXTERNAL_ALL_USERS,
            TEMPLE_V2_DEPLOYED.EXTERNAL.MAKER_DAO.DAI_TOKEN,
            TEMPLE_V2_DEPLOYED.CORE.CIRCUIT_BREAKER_PROXY
        ));
    }

    // Add minters & other token inilizations
    {
        // dUsd
        await mine(templeV2contracts.dusd.addMinter(await owner.getAddress()));
        await mine(templeV2contracts.dusd.addMinter(TEMPLE_V2_DEPLOYED.TREASURY_RESERVES_VAULT.ADDRESS));
        // temple
        await mine(templeV2contracts.templeToken.addMinter(TEMPLE_V2_DEPLOYED.STRATEGIES.TEMPLE_BASE_STRATEGY.ADDRESS));
        // dTemple
        await mine(templeV2contracts.dtemple.addMinter(await owner.getAddress()));
        await mine(templeV2contracts.dtemple.addMinter(TEMPLE_V2_DEPLOYED.TREASURY_RESERVES_VAULT.ADDRESS));
        // TODO: Others???
    }

    // Set borrow tokens for TRV
    {
        // dai -> dUsd
        await mine(templeV2contracts.trv.setBorrowToken(
            TEMPLE_V2_DEPLOYED.EXTERNAL.MAKER_DAO.DAI_TOKEN,
            TEMPLE_V2_DEPLOYED.STRATEGIES.TEMPLE_BASE_STRATEGY.ADDRESS,
            0,
            0,
            TEMPLE_V2_DEPLOYED.TREASURY_RESERVES_VAULT.D_USD_TOKEN
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

    // Set Temple base strategy
    {   
        const debtCeiling: ITempleStrategy.AssetBalanceStruct[] = [{
            asset: TEMPLE_V2_DEPLOYED.EXTERNAL.MAKER_DAO.DAI_TOKEN,
            balance: ethers.utils.parseEther("1.01") // TODO: check value
        }];

        await mine(templeV2contracts.trv.addStrategy(
            TEMPLE_V2_DEPLOYED.STRATEGIES.TEMPLE_BASE_STRATEGY.ADDRESS,
            0, // underperformingEquityThreeshold
            debtCeiling
        ));
    }

    // Set TLC strategy
    {   
        const debtCeiling: ITempleStrategy.AssetBalanceStruct[] = [{
            asset: TEMPLE_V2_DEPLOYED.EXTERNAL.MAKER_DAO.DAI_TOKEN,
            balance: ethers.utils.parseEther("100") // TODO: check value
        }];

        await mine(templeV2contracts.trv.addStrategy(
            TEMPLE_V2_DEPLOYED.STRATEGIES.TLC_STRATEGY.ADDRESS,
            0, // underperformingEquityThreeshold
            debtCeiling
        ));
    }

    // Set DSR strategy
    {   
        const debtCeiling: ITempleStrategy.AssetBalanceStruct[] = [{
            asset: TEMPLE_V2_DEPLOYED.EXTERNAL.MAKER_DAO.DAI_TOKEN,
            balance: ethers.utils.parseEther("100") // TODO: check value
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