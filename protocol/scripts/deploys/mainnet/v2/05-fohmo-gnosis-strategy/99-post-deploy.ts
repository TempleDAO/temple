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

const NAME = "FohmoStrategy";
// NAME_HASH === 0x4636ad4b030b2202c1535278671ad49fa591ff1ca722bee883692b03d34e68c8
const NAME_HASH = ethers.utils.keccak256(ethers.utils.toUtf8Bytes(NAME));

// These will need to be created from the executor multisig
async function setupFromExecutorMultisig() {
    {
        // Circuit breaker identifiers
        await mine(TEMPLE_V2_EXECUTOR_INSTANCES.CORE.CIRCUIT_BREAKER_PROXY.setIdentifierForCaller(
            TEMPLE_V2_ADDRESSES.STRATEGIES.FOHMO_GNOSIS_STRATEGY.ADDRESS,
            NAME
        ));
        
        // Circuit breaker for Dai
        await mine(TEMPLE_V2_EXECUTOR_INSTANCES.CORE.CIRCUIT_BREAKER_PROXY.setCircuitBreaker(
            NAME_HASH,
            TEMPLE_V2_ADDRESSES.EXTERNAL.MAKER_DAO.DAI_TOKEN,
            TEMPLE_V2_ADDRESSES.STRATEGIES.FOHMO_GNOSIS_STRATEGY.CIRCUIT_BREAKERS.DAI
        ));

        // No Temple CB for the main treasury strategy
        // Circuit breaker for Temple
        // await mine(TEMPLE_V2_EXECUTOR_INSTANCES.CORE.CIRCUIT_BREAKER_PROXY.setCircuitBreaker(
        //     NAME_HASH,
        //     TEMPLE_V2_ADDRESSES.CORE.TEMPLE_TOKEN,
        //     TEMPLE_V2_ADDRESSES.STRATEGIES.FOHMO_GNOSIS_STRATEGY.CIRCUIT_BREAKERS.TEMPLE
        // ));
    }

    {
        const debtCeiling: ITempleStrategy.AssetBalanceStruct[] = [
            {
                asset: TEMPLE_V2_ADDRESSES.EXTERNAL.MAKER_DAO.DAI_TOKEN,
                balance: ethers.utils.parseEther("2000000"), // $2mm
            },
            {
                asset: TEMPLE_V2_ADDRESSES.CORE.TEMPLE_TOKEN,
                balance: ethers.utils.parseEther("0"), // No temple debt allowed
            }
        ];

        await mine(TEMPLE_V2_EXECUTOR_INSTANCES.TREASURY_RESERVES_VAULT.INSTANCE.addStrategy(
            TEMPLE_V2_ADDRESSES.STRATEGIES.FOHMO_GNOSIS_STRATEGY.ADDRESS,
            0, // underperformingEquityThreshold
            debtCeiling
        ));
    }
}

async function setup() {
    {
        // Grant permission for the circuit breaker proxy to call the underlying circuit breakers
        await setExplicitAccess(
            TEMPLE_V2_INSTANCES.STRATEGIES.FOHMO_GNOSIS_STRATEGY.CIRCUIT_BREAKERS.DAI,
            TEMPLE_V2_ADDRESSES.CORE.CIRCUIT_BREAKER_PROXY,
            ["preCheck"],
            true
        );

        // No Temple CB for the main treasury strategy
        // await setExplicitAccess(
        //     TEMPLE_V2_INSTANCES.STRATEGIES.FOHMO_GNOSIS_STRATEGY.CIRCUIT_BREAKERS.TEMPLE,
        //     TEMPLE_V2_ADDRESSES.CORE.CIRCUIT_BREAKER_PROXY,
        //     ["preCheck"],
        //     true
        // );
    }

    {
        // Register DAI and Temple as the tokens to track
        // And also OHM/GOHM
        await mine(TEMPLE_V2_INSTANCES.STRATEGIES.FOHMO_GNOSIS_STRATEGY.INSTANCE.setAssets([
            TEMPLE_V2_ADDRESSES.EXTERNAL.MAKER_DAO.DAI_TOKEN,
            TEMPLE_V2_ADDRESSES.CORE.TEMPLE_TOKEN,
            TEMPLE_V2_ADDRESSES.EXTERNAL.OLYMPUS.OHM_TOKEN,
            TEMPLE_V2_ADDRESSES.EXTERNAL.OLYMPUS.GOHM_TOKEN,
        ]));
    }
}

async function setupMultiOtcMarkets() {
    // dai-ohm. `userBuyToken` is DAI
    await mine(TEMPLE_V2_INSTANCES.STRATEGIES.FOHMO_GNOSIS_STRATEGY.OTC_OFFER.MULTI_OTC_OFFER.addOtcMarket(
        {
            fundsOwner: TEMPLE_V2_ADDRESSES.STRATEGIES.FOHMO_GNOSIS_STRATEGY.UNDERLYING_GNOSIS_SAFE,
            userBuyToken: TEMPLE_V2_ADDRESSES.EXTERNAL.MAKER_DAO.DAI_TOKEN,
            userSellToken: TEMPLE_V2_ADDRESSES.EXTERNAL.OLYMPUS.OHM_TOKEN,
            offerPricingToken: 0, // userBuyToken
            minValidOfferPrice: ethers.utils.parseEther("11"), // minOfferPrice
            maxValidOfferPrice: ethers.utils.parseEther("12"), //maxOfferPrice
            scalar: 0, // default scalar
            offerPrice: ethers.utils.parseEther("11.8") // offerPrice
        }
    ));

    // ohm-dai. `userBuyToken` is OHM
    await mine(TEMPLE_V2_INSTANCES.STRATEGIES.FOHMO_GNOSIS_STRATEGY.OTC_OFFER.MULTI_OTC_OFFER.addOtcMarket(
        {
            fundsOwner: TEMPLE_V2_ADDRESSES.STRATEGIES.FOHMO_GNOSIS_STRATEGY.UNDERLYING_GNOSIS_SAFE,
            userBuyToken: TEMPLE_V2_ADDRESSES.EXTERNAL.OLYMPUS.OHM_TOKEN,
            userSellToken: TEMPLE_V2_ADDRESSES.EXTERNAL.MAKER_DAO.DAI_TOKEN,
            offerPricingToken: 1,
            minValidOfferPrice: ethers.utils.parseEther("13.75"),
            maxValidOfferPrice: ethers.utils.parseEther("19"),
            scalar: 0,
            offerPrice: ethers.utils.parseEther("13.9"),
        }
    ));

    // dai-gohm
    await mine(TEMPLE_V2_INSTANCES.STRATEGIES.FOHMO_GNOSIS_STRATEGY.OTC_OFFER.MULTI_OTC_OFFER.addOtcMarket(
        {
            fundsOwner: TEMPLE_V2_ADDRESSES.STRATEGIES.FOHMO_GNOSIS_STRATEGY.UNDERLYING_GNOSIS_SAFE,
            userBuyToken: TEMPLE_V2_ADDRESSES.EXTERNAL.MAKER_DAO.DAI_TOKEN,
            userSellToken: TEMPLE_V2_ADDRESSES.EXTERNAL.OLYMPUS.GOHM_TOKEN,
            offerPricingToken: 0,
            minValidOfferPrice: ethers.utils.parseEther("2900"),
            maxValidOfferPrice: ethers.utils.parseEther("3300"),
            scalar: 0,
            offerPrice: ethers.utils.parseEther("3177"),
        }
    ));
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
        TEMPLE_V2_INSTANCES.STRATEGIES.FOHMO_GNOSIS_STRATEGY.INSTANCE,
        TEMPLE_V2_ADDRESSES.CORE.EXECUTOR_MSIG,
    );
    await proposeCore(TEMPLE_V2_INSTANCES.STRATEGIES.FOHMO_GNOSIS_STRATEGY.CIRCUIT_BREAKERS.DAI);
    // await proposeCore(TEMPLE_V2_INSTANCES.STRATEGIES.FOHMO_GNOSIS_STRATEGY.CIRCUIT_BREAKERS.TEMPLE);

    await mine(TEMPLE_V2_INSTANCES.STRATEGIES.FOHMO_GNOSIS_STRATEGY.OTC_OFFER.OHM_DAI.transferOwnership(TEMPLE_V2_ADDRESSES.CORE.EXECUTOR_MSIG));
    await proposeExecutor(
        TEMPLE_V2_INSTANCES.STRATEGIES.FOHMO_GNOSIS_STRATEGY.OTC_OFFER.MULTI_OTC_OFFER,
        TEMPLE_V2_ADDRESSES.CORE.EXECUTOR_MSIG,
    );
}

async function main() {
    ensureExpectedEnvvars();
    const [owner] = await ethers.getSigners();
    TEMPLE_V2_ADDRESSES = getDeployedContracts();
    TEMPLE_V2_INSTANCES = connectToContracts(owner);

    // await setup();
    // await setupFromExecutorMultisig();
    // await setupMultiOtcMarkets();

    // await transferOwnership();
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });