import "@nomiclabs/hardhat-ethers";
import { ethers } from "hardhat";
import {
  ensureExpectedEnvvars,
  mine,
  setExplicitAccess,
  toAtto
} from "../../../helpers";
import { ContractInstances, ContractAddresses, connectToContracts, getDeployedContracts } from "../contract-addresses";
import { AuraStaking, ITempleStrategy, Ramos } from "../../../../../typechain";

async function setupCircuitBreakers(TEMPLE_V2_ADDRESSES: ContractAddresses, TEMPLE_V2_INSTANCES: ContractInstances) {
    const RAMOS = "RAMOS";
    const RAMOS_HASH = ethers.utils.keccak256(ethers.utils.toUtf8Bytes(RAMOS));

    // Circuit breaker identifiers
    await mine(TEMPLE_V2_INSTANCES.CORE.CIRCUIT_BREAKER_PROXY.setIdentifierForCaller(
        TEMPLE_V2_ADDRESSES.STRATEGIES.RAMOS_STRATEGY.ADDRESS,
        RAMOS
    ));

    // Circuit breaker for Temple
    await mine(TEMPLE_V2_INSTANCES.CORE.CIRCUIT_BREAKER_PROXY.setCircuitBreaker(
        RAMOS_HASH,
        TEMPLE_V2_ADDRESSES.CORE.TEMPLE_TOKEN,
        TEMPLE_V2_ADDRESSES.STRATEGIES.RAMOS_STRATEGY.CIRCUIT_BREAKERS.TEMPLE
    ));

    // Circuit breaker for Dai
    await mine(TEMPLE_V2_INSTANCES.CORE.CIRCUIT_BREAKER_PROXY.setCircuitBreaker(
        RAMOS_HASH,
        TEMPLE_V2_ADDRESSES.EXTERNAL.MAKER_DAO.DAI_TOKEN,
        TEMPLE_V2_ADDRESSES.STRATEGIES.RAMOS_STRATEGY.CIRCUIT_BREAKERS.DAI
    ));

    // Grant permission for the circuit breaker proxy to call the underlying circuit breakers
    await setExplicitAccess(
        TEMPLE_V2_INSTANCES.STRATEGIES.RAMOS_STRATEGY.CIRCUIT_BREAKERS.DAI,
        TEMPLE_V2_ADDRESSES.CORE.CIRCUIT_BREAKER_PROXY,
        ["preCheck"],
        true
    );
    await setExplicitAccess(
        TEMPLE_V2_INSTANCES.STRATEGIES.RAMOS_STRATEGY.CIRCUIT_BREAKERS.TEMPLE,
        TEMPLE_V2_ADDRESSES.CORE.CIRCUIT_BREAKER_PROXY,
        ["preCheck"],
        true
    );
}

async function ramosPostDeploy(ramos: Ramos, TEMPLE_V2_ADDRESSES: ContractAddresses) {
    await mine(ramos.setTokenVault(TEMPLE_V2_ADDRESSES.STRATEGIES.RAMOS_STRATEGY.ADDRESS));
    await mine(ramos.setTpiOracle(TEMPLE_V2_ADDRESSES.TREASURY_RESERVES_VAULT.TPI_ORACLE));
    await mine(ramos.setCoolDown(1800));
    await mine(ramos.setRebalancePercentageBounds(100, 1_000));  // rebalance_up if 1% below, rebalance_down if 10% above
    await mine(ramos.setMaxRebalanceAmounts(toAtto(1_000_000), toAtto(1_000_000), toAtto(1_000_000))); // 1Mill max on each
    await mine(ramos.setPostRebalanceDelta(5_000)); // 50%
    await mine(ramos.setPoolHelper(TEMPLE_V2_ADDRESSES.RAMOS.TEMPLE_DAI.POOL_HELPER));

    // The Automation EOA is allowed to call ramos.
    await setExplicitAccess(
        ramos,
        TEMPLE_V2_ADDRESSES.RAMOS.AUTOMATION_EOA,
        [
            "rebalanceUpExit", // Unstake & single side withdraw TEMPLE, burn TEMPLE
            "rebalanceDownJoin", // Mint TEMPLE, single side deposit, stake bpt
        ],
        true
    );
}

async function stakingPostDeploy(auraStaking: AuraStaking, TEMPLE_V2_ADDRESSES: ContractAddresses) {
    // RAMOS is allowed to call auraStaking.withdrawAndUnwrap() and auraStaking.depositAndStake()
    await setExplicitAccess(
        auraStaking,
        TEMPLE_V2_ADDRESSES.RAMOS.TEMPLE_DAI.ADDRESS,
        ["withdrawAndUnwrap", "depositAndStake"],
        true
    );

    {
        await auraStaking.setRewardsRecipient(
            TEMPLE_V2_ADDRESSES.RAMOS.TEMPLE_DAI.FEE_COLLECTOR
        );

        await auraStaking.setAuraPoolInfo(
            parseInt(TEMPLE_V2_ADDRESSES.RAMOS.TEMPLE_DAI.EXTERNAL.AURA_POOL_ID), 
            TEMPLE_V2_ADDRESSES.RAMOS.TEMPLE_DAI.EXTERNAL.BALANCER_LP_TOKEN, 
            TEMPLE_V2_ADDRESSES.RAMOS.TEMPLE_DAI.EXTERNAL.AURA_REWARDS,
        );
    }
}

async function addRamosStrategy(TEMPLE_V2_ADDRESSES: ContractAddresses, TEMPLE_V2_INSTANCES: ContractInstances) {
    const debtCeiling: ITempleStrategy.AssetBalanceStruct[] = [
        {
            asset: TEMPLE_V2_ADDRESSES.EXTERNAL.MAKER_DAO.DAI_TOKEN,
            balance: ethers.utils.parseEther("5000000"), // 5mm
        },
        {
            asset: TEMPLE_V2_ADDRESSES.CORE.TEMPLE_TOKEN,
            balance: ethers.utils.parseEther("5000000"), // 5mm
        }
    ];

    await mine(TEMPLE_V2_INSTANCES.TREASURY_RESERVES_VAULT.INSTANCE.addStrategy(
        TEMPLE_V2_ADDRESSES.STRATEGIES.RAMOS_STRATEGY.ADDRESS,
        0, // underperformingEquityThreeshold
        debtCeiling
    ));

    // RAMOS is allowed to call:
    //   RamosStrategy.borrowProtocolToken()
    //   RamosStrategy.repayProtocolToken()
    //   RamosStrategy.borrowQuoteToken()
    //   RamosStrategy.repayQuoteToken()
    await setExplicitAccess(
        TEMPLE_V2_INSTANCES.STRATEGIES.RAMOS_STRATEGY.INSTANCE,
        TEMPLE_V2_ADDRESSES.RAMOS.TEMPLE_DAI.ADDRESS,
        [
            "borrowProtocolToken",
            "repayProtocolToken",
            "borrowQuoteToken",
            "repayQuoteToken",
        ],
        true
    );

    // Ramos Strategy is allowed to call:
    //    Ramos.addLiquidity()
    //    Ramos.removeLiquidity()
    await setExplicitAccess(
        TEMPLE_V2_INSTANCES.RAMOS.TEMPLE_DAI.INSTANCE,
        TEMPLE_V2_ADDRESSES.STRATEGIES.RAMOS_STRATEGY.ADDRESS,
        [
            "addLiquidity",
            "removeLiquidity",
        ],
        true
    );
}

async function main() {
    ensureExpectedEnvvars();
    const [owner] = await ethers.getSigners();
    const TEMPLE_V2_INSTANCES = connectToContracts(owner);
    const TEMPLE_V2_ADDRESSES = getDeployedContracts();

    await setupCircuitBreakers(TEMPLE_V2_ADDRESSES, TEMPLE_V2_INSTANCES);
    await ramosPostDeploy(TEMPLE_V2_INSTANCES.RAMOS.TEMPLE_DAI.INSTANCE, TEMPLE_V2_ADDRESSES);
    await stakingPostDeploy(TEMPLE_V2_INSTANCES.RAMOS.TEMPLE_DAI.AURA_STAKING, TEMPLE_V2_ADDRESSES);
    await addRamosStrategy(TEMPLE_V2_ADDRESSES, TEMPLE_V2_INSTANCES);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });