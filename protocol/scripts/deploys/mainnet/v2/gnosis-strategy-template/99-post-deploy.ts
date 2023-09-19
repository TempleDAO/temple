import "@nomiclabs/hardhat-ethers";
import { ethers } from "hardhat";
import {
  ensureExpectedEnvvars,
  mine,
  setExplicitAccess,
} from "../../../helpers";
import { ContractInstances, ContractAddresses, connectToContracts, getDeployedContracts } from "../contract-addresses";
import { ITempleStrategy } from "../../../../../typechain";

async function setupCircuitBreakers(TEMPLE_V2_ADDRESSES: ContractAddresses, TEMPLE_V2_INSTANCES: ContractInstances) {
    const GNOSIS_SAFE_STRATEGIES = "GNOSIS_SAFE_STRATEGIES";
    const GNOSIS_SAFE_STRATEGIES_HASH = ethers.utils.keccak256(ethers.utils.toUtf8Bytes(GNOSIS_SAFE_STRATEGIES));

    // Circuit breaker identifiers
    await mine(TEMPLE_V2_INSTANCES.CORE.CIRCUIT_BREAKER_PROXY.setIdentifierForCaller(
        TEMPLE_V2_ADDRESSES.STRATEGIES.GNOSIS_SAFE_STRATEGY_TEMPLATE.ADDRESS,
        GNOSIS_SAFE_STRATEGIES
    ));

    // Circuit breaker for Temple
    await mine(TEMPLE_V2_INSTANCES.CORE.CIRCUIT_BREAKER_PROXY.setCircuitBreaker(
        GNOSIS_SAFE_STRATEGIES_HASH,
        TEMPLE_V2_ADDRESSES.CORE.TEMPLE_TOKEN,
        TEMPLE_V2_ADDRESSES.STRATEGIES.GNOSIS_SAFE_STRATEGY_TEMPLATE.CIRCUIT_BREAKERS.TEMPLE
    ));

    // Circuit breaker for Dai
    await mine(TEMPLE_V2_INSTANCES.CORE.CIRCUIT_BREAKER_PROXY.setCircuitBreaker(
        GNOSIS_SAFE_STRATEGIES_HASH,
        TEMPLE_V2_ADDRESSES.EXTERNAL.MAKER_DAO.DAI_TOKEN,
        TEMPLE_V2_ADDRESSES.STRATEGIES.GNOSIS_SAFE_STRATEGY_TEMPLATE.CIRCUIT_BREAKERS.DAI
    ));

    // Grant permission for the circuit breaker proxy to call the underlying circuit breakers
    await setExplicitAccess(
        TEMPLE_V2_INSTANCES.STRATEGIES.GNOSIS_SAFE_STRATEGY_TEMPLATE.CIRCUIT_BREAKERS.DAI,
        TEMPLE_V2_ADDRESSES.CORE.CIRCUIT_BREAKER_PROXY,
        ["preCheck"],
        true
    );
    await setExplicitAccess(
        TEMPLE_V2_INSTANCES.STRATEGIES.GNOSIS_SAFE_STRATEGY_TEMPLATE.CIRCUIT_BREAKERS.TEMPLE,
        TEMPLE_V2_ADDRESSES.CORE.CIRCUIT_BREAKER_PROXY,
        ["preCheck"],
        true
    );
}

async function addGnosisStrategy(TEMPLE_V2_ADDRESSES: ContractAddresses, TEMPLE_V2_INSTANCES: ContractInstances) {
    const debtCeiling: ITempleStrategy.AssetBalanceStruct[] = [
        {
            asset: TEMPLE_V2_ADDRESSES.EXTERNAL.MAKER_DAO.DAI_TOKEN,
            balance: ethers.utils.parseEther("100000"),
        },
        {
            asset: TEMPLE_V2_ADDRESSES.CORE.TEMPLE_TOKEN,
            balance: ethers.utils.parseEther("100000")
        }
    ];

    await mine(TEMPLE_V2_INSTANCES.TREASURY_RESERVES_VAULT.INSTANCE.addStrategy(
        TEMPLE_V2_ADDRESSES.STRATEGIES.GNOSIS_SAFE_STRATEGY_TEMPLATE.ADDRESS,
        0, // underperformingEquityThreeshold
        debtCeiling
    ));

    // Register DAI and Temple as the tokens to track
    await mine(TEMPLE_V2_INSTANCES.STRATEGIES.GNOSIS_SAFE_STRATEGY_TEMPLATE.INSTANCE.setAssets([
        TEMPLE_V2_ADDRESSES.EXTERNAL.MAKER_DAO.DAI_TOKEN,
        TEMPLE_V2_ADDRESSES.CORE.TEMPLE_TOKEN,
    ]));
}

async function main() {
    ensureExpectedEnvvars();
    const [owner] = await ethers.getSigners();
    const TEMPLE_V2_INSTANCES = connectToContracts(owner);
    const TEMPLE_V2_ADDRESSES = getDeployedContracts();

    await setupCircuitBreakers(TEMPLE_V2_ADDRESSES, TEMPLE_V2_INSTANCES);
    await addGnosisStrategy(TEMPLE_V2_ADDRESSES, TEMPLE_V2_INSTANCES);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });