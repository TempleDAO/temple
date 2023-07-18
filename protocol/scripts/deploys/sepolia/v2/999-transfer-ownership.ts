import '@nomiclabs/hardhat-ethers';
import { ethers } from 'hardhat';
import {
    ensureExpectedEnvvars,
    mine,
} from '../../helpers';
import { TempleElevatedAccess } from '../../../../typechain';
import { ContractAddresses, connectToContracts, getDeployedContracts } from './contract-addresses';

async function proposeExecutorAndRescuer(contract: TempleElevatedAccess, executor: string, rescuer: string) {
    await mine(contract.proposeNewExecutor(executor));
    await mine(contract.proposeNewRescuer(rescuer));
}

async function proposeCore(TEMPLE_V2_ADDRESSES: ContractAddresses, contract: TempleElevatedAccess) {
    await proposeExecutorAndRescuer(contract, TEMPLE_V2_ADDRESSES.CORE.EXECUTOR_MSIG, TEMPLE_V2_ADDRESSES.CORE.RESCUER_MSIG)
}

async function main() {
    ensureExpectedEnvvars();
    const [owner] = await ethers.getSigners();
    const TEMPLE_V2_ADDRESSES = getDeployedContracts();
    const TEMPLE_V2_INSTANCES = connectToContracts(owner);

    // Transfer ownership to the multisig
    await mine(TEMPLE_V2_INSTANCES.CORE.TEMPLE_TOKEN.transferOwnership(TEMPLE_V2_ADDRESSES.CORE.EXECUTOR_MSIG));

    // Propose new executor
    {
        await proposeCore(TEMPLE_V2_ADDRESSES, TEMPLE_V2_INSTANCES.CORE.CIRCUIT_BREAKER_PROXY);
        await proposeCore(TEMPLE_V2_ADDRESSES, TEMPLE_V2_INSTANCES.TREASURY_RESERVES_VAULT.INSTANCE);
        await proposeCore(TEMPLE_V2_ADDRESSES, TEMPLE_V2_INSTANCES.TREASURY_RESERVES_VAULT.D_USD_TOKEN);
        await proposeCore(TEMPLE_V2_ADDRESSES, TEMPLE_V2_INSTANCES.TREASURY_RESERVES_VAULT.D_TEMPLE_TOKEN);
        await proposeCore(TEMPLE_V2_ADDRESSES, TEMPLE_V2_INSTANCES.TREASURY_RESERVES_VAULT.TPI_ORACLE);

        await proposeCore(TEMPLE_V2_ADDRESSES, TEMPLE_V2_INSTANCES.TEMPLE_LINE_OF_CREDIT.INSTANCE);
        await proposeCore(TEMPLE_V2_ADDRESSES, TEMPLE_V2_INSTANCES.TEMPLE_LINE_OF_CREDIT.CIRCUIT_BREAKERS.DAI);
        await proposeCore(TEMPLE_V2_ADDRESSES, TEMPLE_V2_INSTANCES.TEMPLE_LINE_OF_CREDIT.CIRCUIT_BREAKERS.TEMPLE);
        await proposeCore(TEMPLE_V2_ADDRESSES, TEMPLE_V2_INSTANCES.TEMPLE_LINE_OF_CREDIT.INTEREST_RATE_MODELS.LINEAR_WITH_KINK);

        await proposeCore(TEMPLE_V2_ADDRESSES, TEMPLE_V2_INSTANCES.RAMOS.TEMPLE_DAI.INSTANCE);
        await proposeCore(TEMPLE_V2_ADDRESSES, TEMPLE_V2_INSTANCES.RAMOS.TEMPLE_DAI.AURA_STAKING);
        await proposeCore(TEMPLE_V2_ADDRESSES, TEMPLE_V2_INSTANCES.RAMOS.TEMPLE_DAI.INSTANCE);

        await proposeExecutorAndRescuer(
            TEMPLE_V2_INSTANCES.STRATEGIES.DSR_BASE_STRATEGY.INSTANCE,
            TEMPLE_V2_ADDRESSES.STRATEGIES.DSR_BASE_STRATEGY.EXECUTOR_MSIG,
            TEMPLE_V2_ADDRESSES.STRATEGIES.DSR_BASE_STRATEGY.RESCUER_MSIG,
        );
        await proposeExecutorAndRescuer(
            TEMPLE_V2_INSTANCES.STRATEGIES.TEMPLE_BASE_STRATEGY.INSTANCE,
            TEMPLE_V2_ADDRESSES.STRATEGIES.TEMPLE_BASE_STRATEGY.EXECUTOR_MSIG,
            TEMPLE_V2_ADDRESSES.STRATEGIES.TEMPLE_BASE_STRATEGY.RESCUER_MSIG,
        );
        await proposeExecutorAndRescuer(
            TEMPLE_V2_INSTANCES.STRATEGIES.RAMOS_STRATEGY.INSTANCE,
            TEMPLE_V2_ADDRESSES.STRATEGIES.RAMOS_STRATEGY.EXECUTOR_MSIG,
            TEMPLE_V2_ADDRESSES.STRATEGIES.RAMOS_STRATEGY.RESCUER_MSIG,
        );
        await proposeCore(TEMPLE_V2_ADDRESSES, TEMPLE_V2_INSTANCES.STRATEGIES.RAMOS_STRATEGY.CIRCUIT_BREAKERS.DAI);
        await proposeCore(TEMPLE_V2_ADDRESSES, TEMPLE_V2_INSTANCES.STRATEGIES.RAMOS_STRATEGY.CIRCUIT_BREAKERS.TEMPLE);

        await proposeExecutorAndRescuer(
            TEMPLE_V2_INSTANCES.STRATEGIES.TLC_STRATEGY.INSTANCE,
            TEMPLE_V2_ADDRESSES.STRATEGIES.TLC_STRATEGY.EXECUTOR_MSIG,
            TEMPLE_V2_ADDRESSES.STRATEGIES.TLC_STRATEGY.RESCUER_MSIG,
        );
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
