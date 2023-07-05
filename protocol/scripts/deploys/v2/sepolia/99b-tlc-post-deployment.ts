import { ethers } from 'hardhat';
import {
    ensureExpectedEnvvars,
    mine,
    setExplicitAccess,
} from '../../helpers';
import { connectToContracts, getDeployedContracts } from './contract-addresses';
import { ITempleStrategy } from '../../../../typechain';

async function main() {
    ensureExpectedEnvvars();
  
    const [owner] = await ethers.getSigners();
    const TEMPLE_V2_DEPLOYED = getDeployedContracts();
    const templeV2contracts = connectToContracts(owner);
    const EXTERNAL_ALL_USERS = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("EXTERNAL_USER"));

    // Setup Circuit Breaker
    {
        // Circuit breaker identifiers
        await mine(templeV2contracts.circuitBreakerProxy.setIdentifierForCaller(
            TEMPLE_V2_DEPLOYED.TEMPLE_LINE_OF_CREDIT.ADDRESS,
            "EXTERNAL_USER"
        ));

        // Circuit breaker for Temple
        await mine(templeV2contracts.circuitBreakerProxy.setCircuitBreaker(
            EXTERNAL_ALL_USERS,
            TEMPLE_V2_DEPLOYED.CORE.TEMPLE_TOKEN,
            TEMPLE_V2_DEPLOYED.TEMPLE_LINE_OF_CREDIT.CIRCUIT_BREAKERS.TEMPLE
        ));

        // Circuit breaker for Dai
        await mine(templeV2contracts.circuitBreakerProxy.setCircuitBreaker(
            EXTERNAL_ALL_USERS,
            TEMPLE_V2_DEPLOYED.EXTERNAL.MAKER_DAO.DAI_TOKEN,
            TEMPLE_V2_DEPLOYED.TEMPLE_LINE_OF_CREDIT.CIRCUIT_BREAKERS.DAI
        ));

        // Grant permission for the circuit breaker proxy to call the underlying circuit breakers
        await mine(await setExplicitAccess(
            templeV2contracts.tlcCircuitBreakerDai,
            TEMPLE_V2_DEPLOYED.CORE.CIRCUIT_BREAKER_PROXY,
            ["preCheck"],
            true
        ));
        await mine(await setExplicitAccess(
            templeV2contracts.tlcCircuitBreakerTemple,
            TEMPLE_V2_DEPLOYED.CORE.CIRCUIT_BREAKER_PROXY,
            ["preCheck"],
            true
        ));
    }

    // Set TLC strategy
    {   
        const debtCeiling: ITempleStrategy.AssetBalanceStruct[] = [{
            asset: TEMPLE_V2_DEPLOYED.EXTERNAL.MAKER_DAO.DAI_TOKEN,
            balance: ethers.utils.parseEther("100000")
        }];

        await mine(templeV2contracts.trv.addStrategy(
            TEMPLE_V2_DEPLOYED.STRATEGIES.TLC_STRATEGY.ADDRESS,
            0, // underperformingEquityThreeshold
            debtCeiling
        ));

        await mine(templeV2contracts.tlc.setTlcStrategy(TEMPLE_V2_DEPLOYED.STRATEGIES.TLC_STRATEGY.ADDRESS));
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