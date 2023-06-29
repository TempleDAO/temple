import { ethers } from 'hardhat';
import {
    ensureExpectedEnvvars,
    mine,
    setExplicitAccess
} from '../../helpers';
import { 
    connectToContracts,
    getDeployedContracts,
} from './contract-addresses';

async function main() {
    ensureExpectedEnvvars();
  
    const [owner] = await ethers.getSigners();
    const TEMPLE_V2_DEPLOYED = getDeployedContracts();
    const templeV2contracts = connectToContracts(owner);
    const EXTERNAL_ALL_USERS = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("EXTERNAL_USER"));

    // Setup Circuit Breaker
    {

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
        await mine (await setExplicitAccess(
            templeV2contracts.tlcCircuitBreakerTemple,
            TEMPLE_V2_DEPLOYED.CORE.CIRCUIT_BREAKER_PROXY,
            ["preCheck"],
            true
        ));

        // Circuit breaker identifiers
        await mine(templeV2contracts.circuitBreakerProxy.setIdentifierForCaller(
            TEMPLE_V2_DEPLOYED.TEMPLE_LINE_OF_CREDIT.ADDRESS,
            "EXTERNAL_USER"
        ));
    }

    // Allow minters
    {
        // TRV can mint/burn dUsd & dTemple
        await mine(templeV2contracts.dusd.addMinter(TEMPLE_V2_DEPLOYED.TREASURY_RESERVES_VAULT.ADDRESS));
        await mine(templeV2contracts.dtemple.addMinter(TEMPLE_V2_DEPLOYED.TREASURY_RESERVES_VAULT.ADDRESS));
        // Temple base strategy & multisig can mint/burn temple
        await mine(templeV2contracts.templeToken.addMinter(TEMPLE_V2_DEPLOYED.STRATEGIES.TEMPLE_BASE_STRATEGY.ADDRESS));
        await mine(templeV2contracts.templeToken.addMinter(TEMPLE_V2_DEPLOYED.CORE.EXECUTOR_MSIG));
        await mine(templeV2contracts.templeToken.addMinter(TEMPLE_V2_DEPLOYED.CORE.EXECUTOR_MSIG));
        // TODO: remove the following once deploying to mainnet, added just for testnet
        await mine(templeV2contracts.templeToken.addMinter(await owner.getAddress()));
        await mine(templeV2contracts.templeToken.addMinter(await owner.getAddress()));
    }

    // Set borrow tokens for TRV
    {
        // dai -> dUsd
        await mine(templeV2contracts.trv.setBorrowToken(
            TEMPLE_V2_DEPLOYED.EXTERNAL.MAKER_DAO.DAI_TOKEN,
            TEMPLE_V2_DEPLOYED.STRATEGIES.DSR_BASE_STRATEGY.ADDRESS,
            ethers.utils.parseEther('10000'),
            ethers.utils.parseEther('10000'),
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

  }
  
  // We recommend this pattern to be able to use async/await everywhere
  // and properly handle errors.
  main()
    .then(() => process.exit(0))
    .catch(error => {
      console.error(error);
      process.exit(1);
    });