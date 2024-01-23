import "@nomiclabs/hardhat-ethers";
import { ethers } from "hardhat";
import {
  ensureExpectedEnvvars,
  mine,
  setExplicitAccess,
} from "../../../helpers";
import { ContractInstances, ContractAddresses, connectToContracts, getDeployedContracts } from "../contract-addresses";
import { ITempleStrategy, TempleElevatedAccess } from "../../../../../typechain";

let TEMPLE_V2_ADDRESSES: ContractAddresses;
let TEMPLE_V2_INSTANCES: ContractInstances;
let TEMPLE_V2_EXECUTOR_INSTANCES: ContractInstances;

const NAME = "TemploMayorStrategy";
// NAME_HASH === 0xa092432a3a8413c06228829d4bc0b73f18b86660822d4b19f4af4938f700f5f9
const NAME_HASH = ethers.utils.keccak256(ethers.utils.toUtf8Bytes(NAME));

// These will need to be created from the executor multisig
async function setupFromExecutorMultisig() {
    {
        // Circuit breaker identifiers
        await mine(TEMPLE_V2_EXECUTOR_INSTANCES.CORE.CIRCUIT_BREAKER_PROXY.setIdentifierForCaller(
            TEMPLE_V2_ADDRESSES.STRATEGIES.TEMPLO_MAYOR_GNOSIS_STRATEGY.ADDRESS,
            NAME
        ));
        
        // Circuit breaker for Dai
        await mine(TEMPLE_V2_EXECUTOR_INSTANCES.CORE.CIRCUIT_BREAKER_PROXY.setCircuitBreaker(
            NAME_HASH,
            TEMPLE_V2_ADDRESSES.EXTERNAL.MAKER_DAO.DAI_TOKEN,
            TEMPLE_V2_ADDRESSES.STRATEGIES.TEMPLO_MAYOR_GNOSIS_STRATEGY.CIRCUIT_BREAKERS.DAI
        ));

        // No Temple CB for the main treasury strategy
        // Circuit breaker for Temple
        // await mine(TEMPLE_V2_EXECUTOR_INSTANCES.CORE.CIRCUIT_BREAKER_PROXY.setCircuitBreaker(
        //     NAME_HASH,
        //     TEMPLE_V2_ADDRESSES.CORE.TEMPLE_TOKEN,
        //     TEMPLE_V2_ADDRESSES.STRATEGIES.TEMPLO_MAYOR_GNOSIS_STRATEGY.CIRCUIT_BREAKERS.TEMPLE
        // ));
    }

    {
        const debtCeiling: ITempleStrategy.AssetBalanceStruct[] = [
            {
                asset: TEMPLE_V2_ADDRESSES.EXTERNAL.MAKER_DAO.DAI_TOKEN,
                balance: ethers.utils.parseEther("25000000"), // $25mm
            },
            {
                asset: TEMPLE_V2_ADDRESSES.CORE.TEMPLE_TOKEN,
                balance: ethers.utils.parseEther("0"), // No temple debt allowed
            }
        ];

        await mine(TEMPLE_V2_EXECUTOR_INSTANCES.TREASURY_RESERVES_VAULT.INSTANCE.addStrategy(
            TEMPLE_V2_ADDRESSES.STRATEGIES.TEMPLO_MAYOR_GNOSIS_STRATEGY.ADDRESS,
            0, // underperformingEquityThreshold
            debtCeiling
        ));
    }
}

async function setup() {
    {
        // Grant permission for the circuit breaker proxy to call the underlying circuit breakers
        await setExplicitAccess(
            TEMPLE_V2_INSTANCES.STRATEGIES.TEMPLO_MAYOR_GNOSIS_STRATEGY.CIRCUIT_BREAKERS.DAI,
            TEMPLE_V2_ADDRESSES.CORE.CIRCUIT_BREAKER_PROXY,
            ["preCheck"],
            true
        );

        // No Temple CB for the main treasury strategy
        // await setExplicitAccess(
        //     TEMPLE_V2_INSTANCES.STRATEGIES.TEMPLO_MAYOR_GNOSIS_STRATEGY.CIRCUIT_BREAKERS.TEMPLE,
        //     TEMPLE_V2_ADDRESSES.CORE.CIRCUIT_BREAKER_PROXY,
        //     ["preCheck"],
        //     true
        // );
    }

    {
        // Register DAI and Temple as the tokens to track
        await mine(TEMPLE_V2_INSTANCES.STRATEGIES.TEMPLO_MAYOR_GNOSIS_STRATEGY.INSTANCE.setAssets([
            TEMPLE_V2_ADDRESSES.EXTERNAL.MAKER_DAO.DAI_TOKEN,
            TEMPLE_V2_ADDRESSES.CORE.TEMPLE_TOKEN,
        ]));
    }
}

async function proposeExecutor(contract: TempleElevatedAccess, executor: string) {
    console.log(`proposing executor for contract: ${contract.address} = ${executor}`);
    await mine(contract.proposeNewExecutor(executor));
}

async function proposeCore(contract: TempleElevatedAccess) {
    await proposeExecutor(contract, TEMPLE_V2_ADDRESSES.CORE.EXECUTOR_MSIG);
}

async function transferOwnership() {
    await proposeExecutor(
        TEMPLE_V2_INSTANCES.STRATEGIES.TEMPLO_MAYOR_GNOSIS_STRATEGY.INSTANCE,
        TEMPLE_V2_ADDRESSES.CORE.EXECUTOR_MSIG,
    );
    await proposeCore(TEMPLE_V2_INSTANCES.STRATEGIES.TEMPLO_MAYOR_GNOSIS_STRATEGY.CIRCUIT_BREAKERS.DAI);
    // await proposeCore(TEMPLE_V2_INSTANCES.STRATEGIES.TEMPLO_MAYOR_GNOSIS_STRATEGY.CIRCUIT_BREAKERS.TEMPLE);
}

async function main() {
    ensureExpectedEnvvars();
    const [owner] = await ethers.getSigners();
    TEMPLE_V2_ADDRESSES = getDeployedContracts();
    TEMPLE_V2_INSTANCES = connectToContracts(owner);

    await setup();
    // await setupFromExecutorMultisig();
    await transferOwnership();
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });