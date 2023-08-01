import '@nomiclabs/hardhat-ethers';
import { ethers } from 'hardhat';
import {
    ensureExpectedEnvvars,
    mine,
} from '../../../helpers';
import { TempleElevatedAccess } from '../../../../../typechain';
import { ContractAddresses, connectToContracts, getDeployedContracts } from '../contract-addresses';

async function proposeExecutorAndRescuer(contract: TempleElevatedAccess, executor: string, rescuer: string) {
    console.log(`contract: ${contract.address} & executor: ${executor}`);
    console.log(`contract: ${contract.address} & rescuer: ${rescuer}`);
    await mine(contract.proposeNewExecutor(executor));
    await mine(contract.proposeNewRescuer(rescuer));

    console.log(`contract executor: ${await contract.executor()}`);
    console.log(`contract rescuer: ${await contract.rescuer()}`);
}

async function proposeCore(TEMPLE_V2_ADDRESSES: ContractAddresses, contract: TempleElevatedAccess) {
    await proposeExecutorAndRescuer(contract, TEMPLE_V2_ADDRESSES.CORE.EXECUTOR_MSIG, TEMPLE_V2_ADDRESSES.CORE.RESCUER_MSIG)
}

async function main() {
    ensureExpectedEnvvars();
    const [owner] = await ethers.getSigners();
    const TEMPLE_V2_ADDRESSES = getDeployedContracts();
    const TEMPLE_V2_INSTANCES = connectToContracts(owner);

    // Propose new executor & rescuer
    {
        console.log('\n\nCORE.CIRCUIT_BREAKER_PROXY');  
        await proposeCore(TEMPLE_V2_ADDRESSES, TEMPLE_V2_INSTANCES.CORE.CIRCUIT_BREAKER_PROXY);
        console.log('\n\nTREASURY_RESERVES_VAULT.INSTANCE');
        await proposeCore(TEMPLE_V2_ADDRESSES, TEMPLE_V2_INSTANCES.TREASURY_RESERVES_VAULT.INSTANCE);
        console.log('\n\nTREASURY_RESERVES_VAULT.D_USD_TOKEN');
        await proposeCore(TEMPLE_V2_ADDRESSES, TEMPLE_V2_INSTANCES.TREASURY_RESERVES_VAULT.D_USD_TOKEN);
        console.log('\n\nTREASURY_RESERVES_VAULT.D_TEMPLE_TOKEN');
        await proposeCore(TEMPLE_V2_ADDRESSES, TEMPLE_V2_INSTANCES.TREASURY_RESERVES_VAULT.D_TEMPLE_TOKEN);
        console.log('\n\nTREASURY_RESERVES_VAULT.TPI_ORACLE');
        await proposeCore(TEMPLE_V2_ADDRESSES, TEMPLE_V2_INSTANCES.TREASURY_RESERVES_VAULT.TPI_ORACLE);

        console.log('\n\nTEMPLE_LINE_OF_CREDIT.INSTANCE');
        await proposeCore(TEMPLE_V2_ADDRESSES, TEMPLE_V2_INSTANCES.TEMPLE_LINE_OF_CREDIT.INSTANCE);
        console.log('\n\nTEMPLE_LINE_OF_CREDIT.CIRCUIT_BREAKERS.DAI');
        await proposeCore(TEMPLE_V2_ADDRESSES, TEMPLE_V2_INSTANCES.TEMPLE_LINE_OF_CREDIT.CIRCUIT_BREAKERS.DAI);
        console.log('\n\nTEMPLE_LINE_OF_CREDIT.CIRCUIT_BREAKERS.TEMPLE');
        await proposeCore(TEMPLE_V2_ADDRESSES, TEMPLE_V2_INSTANCES.TEMPLE_LINE_OF_CREDIT.CIRCUIT_BREAKERS.TEMPLE);
        console.log('\n\nTEMPLE_LINE_OF_CREDIT.INTEREST_RATE_MODELS.LINEAR_WITH_KINK');
        await proposeCore(TEMPLE_V2_ADDRESSES, TEMPLE_V2_INSTANCES.TEMPLE_LINE_OF_CREDIT.INTEREST_RATE_MODELS.LINEAR_WITH_KINK);

        await proposeCore(TEMPLE_V2_ADDRESSES, TEMPLE_V2_INSTANCES.RAMOS.TEMPLE_DAI.INSTANCE);
        await proposeCore(TEMPLE_V2_ADDRESSES, TEMPLE_V2_INSTANCES.RAMOS.TEMPLE_DAI.AURA_STAKING);

        console.log('\n\nSTRATEGIES.DSR_BASE_STRATEGY');
        await proposeExecutorAndRescuer(
            TEMPLE_V2_INSTANCES.STRATEGIES.DSR_BASE_STRATEGY.INSTANCE,
            TEMPLE_V2_ADDRESSES.STRATEGIES.DSR_BASE_STRATEGY.EXECUTOR_MSIG,
            TEMPLE_V2_ADDRESSES.STRATEGIES.DSR_BASE_STRATEGY.RESCUER_MSIG,
        );
        console.log('\n\nSTRATEGIES.TEMPLE_BASE_STRATEGY');
        await proposeExecutorAndRescuer(
            TEMPLE_V2_INSTANCES.STRATEGIES.TEMPLE_BASE_STRATEGY.INSTANCE,
            TEMPLE_V2_ADDRESSES.STRATEGIES.TEMPLE_BASE_STRATEGY.EXECUTOR_MSIG,
            TEMPLE_V2_ADDRESSES.STRATEGIES.TEMPLE_BASE_STRATEGY.RESCUER_MSIG,
        );

        // await proposeExecutorAndRescuer(
        //   TEMPLE_V2_INSTANCES.STRATEGIES.GNOSIS_SAFE_STRATEGY1.INSTANCE,
        //   TEMPLE_V2_ADDRESSES.STRATEGIES.GNOSIS_SAFE_STRATEGY1.EXECUTOR_MSIG,
        //   TEMPLE_V2_ADDRESSES.STRATEGIES.GNOSIS_SAFE_STRATEGY1.RESCUER_MSIG,
        // );

        // await proposeCore(TEMPLE_V2_ADDRESSES, TEMPLE_V2_INSTANCES.STRATEGIES.GNOSIS_SAFE_STRATEGY1.CIRCUIT_BREAKERS.DAI);
        // await proposeCore(TEMPLE_V2_ADDRESSES, TEMPLE_V2_INSTANCES.STRATEGIES.GNOSIS_SAFE_STRATEGY1.CIRCUIT_BREAKERS.TEMPLE);
        await proposeExecutorAndRescuer(
            TEMPLE_V2_INSTANCES.STRATEGIES.RAMOS_STRATEGY.INSTANCE,
            TEMPLE_V2_ADDRESSES.STRATEGIES.RAMOS_STRATEGY.EXECUTOR_MSIG,
            TEMPLE_V2_ADDRESSES.STRATEGIES.RAMOS_STRATEGY.RESCUER_MSIG,
        );

        await proposeCore(TEMPLE_V2_ADDRESSES, TEMPLE_V2_INSTANCES.STRATEGIES.RAMOS_STRATEGY.CIRCUIT_BREAKERS.DAI);
        await proposeCore(TEMPLE_V2_ADDRESSES, TEMPLE_V2_INSTANCES.STRATEGIES.RAMOS_STRATEGY.CIRCUIT_BREAKERS.TEMPLE);
        console.log('\n\nSTRATEGIES.TLC_STRATEGY');
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
