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

const NAME = "CosechaSegundaStrategy";
// NAME_HASH === 0xde820b10ef783658c3f33f3f9882fadcfff1519ac11b495faf39467e343f8c26
const NAME_HASH = ethers.utils.keccak256(ethers.utils.toUtf8Bytes(NAME));

async function setupFromExecutorMultisig() {
    {
        // Circuit breaker identifiers
        await mine(TEMPLE_V2_EXECUTOR_INSTANCES.CORE.CIRCUIT_BREAKER_PROXY.setIdentifierForCaller(
            TEMPLE_V2_ADDRESSES.STRATEGIES.COSECHA_SEGUNDA_GNOSIS_STRATEGY.ADDRESS,
            NAME
        ));
        
        // Circuit breaker for DAI
        await mine(TEMPLE_V2_EXECUTOR_INSTANCES.CORE.CIRCUIT_BREAKER_PROXY.setCircuitBreaker(
            NAME_HASH,
            TEMPLE_V2_ADDRESSES.EXTERNAL.MAKER_DAO.DAI_TOKEN,
            TEMPLE_V2_ADDRESSES.STRATEGIES.COSECHA_SEGUNDA_GNOSIS_STRATEGY.CIRCUIT_BREAKERS.DAI
        ));
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
            TEMPLE_V2_ADDRESSES.STRATEGIES.COSECHA_SEGUNDA_GNOSIS_STRATEGY.ADDRESS,
            0, // underperformingEquityThreshold
            debtCeiling
        ));
    }
}

async function setup() {
    {
        // Grant permission for the circuit breaker proxy to call the underlying circuit breakers
        await setExplicitAccess(
            TEMPLE_V2_INSTANCES.STRATEGIES.COSECHA_SEGUNDA_GNOSIS_STRATEGY.CIRCUIT_BREAKERS.DAI,
            TEMPLE_V2_ADDRESSES.CORE.CIRCUIT_BREAKER_PROXY,
            ["preCheck"],
            true
        );
    }

    {
        // Register DAI and TEMPLE as the tokens to track
        await mine(TEMPLE_V2_INSTANCES.STRATEGIES.COSECHA_SEGUNDA_GNOSIS_STRATEGY.INSTANCE.setAssets([
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
        TEMPLE_V2_INSTANCES.STRATEGIES.COSECHA_SEGUNDA_GNOSIS_STRATEGY.INSTANCE,
        TEMPLE_V2_ADDRESSES.CORE.EXECUTOR_MSIG,
    );
    await proposeCore(TEMPLE_V2_INSTANCES.STRATEGIES.TEMPLO_MAYOR_GNOSIS_STRATEGY.CIRCUIT_BREAKERS.DAI);
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