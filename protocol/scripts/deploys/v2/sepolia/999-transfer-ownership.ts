import '@nomiclabs/hardhat-ethers';
import { ethers } from 'hardhat';

import {
    ensureExpectedEnvvars,
    mine,
} from '../../helpers';
import { 
    TempleERC20Token__factory,
    TempleCircuitBreakerProxy__factory,
    TreasuryPriceIndexOracle__factory,
    TreasuryReservesVault__factory
} from '../../../../typechain';
import { getDeployedContracts } from '../sepolia/contract-addresses';

async function main() {
    ensureExpectedEnvvars();
    const [owner] = await ethers.getSigners();
    const TEMPLE_V2_DEPLOYED = getDeployedContracts();
    const TEMPLE =  TempleERC20Token__factory.connect(TEMPLE_V2_DEPLOYED.CORE.TEMPLE_TOKEN, owner);
    const TEMPLE_CIRCUIT_BREAKER =  TempleCircuitBreakerProxy__factory.connect(TEMPLE_V2_DEPLOYED.CORE.CIRCUIT_BREAKER_PROXY, owner);
    const TREASURY_PRICE_INDEX_ORACLE =  TreasuryPriceIndexOracle__factory.connect(TEMPLE_V2_DEPLOYED.TREASURY_RESERVES_VAULT.TPI_ORACLE, owner);
    const DTEMPLE =  TempleERC20Token__factory.connect(TEMPLE_V2_DEPLOYED.TREASURY_RESERVES_VAULT.D_TEMPLE_TOKEN, owner);
    // const DUSD =  FakeERC20__factory.connect(TEMPLE_V2_DEPLOYED.TREASURY_RESERVES_VAULT.D_USD_TOKEN, owner);
    const TREASURY_RESERVES_VAULT =  TreasuryReservesVault__factory.connect(TEMPLE_V2_DEPLOYED.TREASURY_RESERVES_VAULT.ADDRESS, owner);
    /* 
    TODO:
    - TLC
    - TLC_IRM_LINEAR_WITH_KINK
    - DSR_BASE_STRATEGY
    - TEMPLE_BASE_STRATEGY
    - TLC_STRATEGY
    - TLC_STRATEGY_CIRCUIT_BREAKER_DAI
    - TLC_STRATEGY_CIRCUIT_BREAKER_TEMPLE
    */



    // Transfer ownership to the multisig
    await mine(TEMPLE.transferOwnership(TEMPLE_V2_DEPLOYED.CORE.EXECUTOR_MSIG));
    await mine(DTEMPLE.transferOwnership(TEMPLE_V2_DEPLOYED.CORE.EXECUTOR_MSIG));

    // Propose new executor
    await mine(TEMPLE_CIRCUIT_BREAKER.proposeNewExecutor(TEMPLE_V2_DEPLOYED.CORE.EXECUTOR_MSIG));
    await mine(TREASURY_PRICE_INDEX_ORACLE.proposeNewExecutor(TEMPLE_V2_DEPLOYED.CORE.EXECUTOR_MSIG));
    await mine(TREASURY_RESERVES_VAULT.proposeNewExecutor(TEMPLE_V2_DEPLOYED.CORE.EXECUTOR_MSIG));
    
    // Propose new rescuer
    await mine(TEMPLE_CIRCUIT_BREAKER.proposeNewRescuer(TEMPLE_V2_DEPLOYED.CORE.RESCUER_MSIG));
    await mine(TREASURY_PRICE_INDEX_ORACLE.proposeNewRescuer(TEMPLE_V2_DEPLOYED.CORE.RESCUER_MSIG));
    await mine(TREASURY_RESERVES_VAULT.proposeNewRescuer(TEMPLE_V2_DEPLOYED.CORE.RESCUER_MSIG));
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
// main()
//   .then(() => process.exit(0))
//   .catch(error => {
//     console.error(error);
//     process.exit(1);
//   });
