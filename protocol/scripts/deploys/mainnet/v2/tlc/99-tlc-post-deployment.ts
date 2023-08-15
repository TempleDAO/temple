import { ethers } from 'hardhat';
import {
    ensureExpectedEnvvars,
    mine,
    setExplicitAccess,
} from '../../../helpers';
import { connectToContracts, getDeployedContracts } from '../contract-addresses';
import { ITempleStrategy } from '../../../../../typechain';

async function main() {
    ensureExpectedEnvvars();
    const [owner] = await ethers.getSigners();
    const TEMPLE_V2_ADDRESSES = getDeployedContracts();
    const TEMPLE_V2_INSTANCES = connectToContracts(owner);
    const EXTERNAL_ALL_USERS = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("EXTERNAL_USER"));

    // Setup Circuit Breaker
    {
        // Circuit breaker identifiers
        await mine(TEMPLE_V2_INSTANCES.CORE.CIRCUIT_BREAKER_PROXY.setIdentifierForCaller(
            TEMPLE_V2_ADDRESSES.TEMPLE_LINE_OF_CREDIT.ADDRESS,
            "EXTERNAL_USER"
        ));

        // Circuit breaker for Temple
        await mine(TEMPLE_V2_INSTANCES.CORE.CIRCUIT_BREAKER_PROXY.setCircuitBreaker(
            EXTERNAL_ALL_USERS,
            TEMPLE_V2_ADDRESSES.CORE.TEMPLE_TOKEN,
            TEMPLE_V2_ADDRESSES.TEMPLE_LINE_OF_CREDIT.CIRCUIT_BREAKERS.TEMPLE
        ));

        // Circuit breaker for Dai
        await mine(TEMPLE_V2_INSTANCES.CORE.CIRCUIT_BREAKER_PROXY.setCircuitBreaker(
            EXTERNAL_ALL_USERS,
            TEMPLE_V2_ADDRESSES.EXTERNAL.MAKER_DAO.DAI_TOKEN,
            TEMPLE_V2_ADDRESSES.TEMPLE_LINE_OF_CREDIT.CIRCUIT_BREAKERS.DAI
        ));

        // Grant permission for the circuit breaker proxy to call the underlying circuit breakers
        await setExplicitAccess(
            TEMPLE_V2_INSTANCES.TEMPLE_LINE_OF_CREDIT.CIRCUIT_BREAKERS.DAI,
            TEMPLE_V2_ADDRESSES.CORE.CIRCUIT_BREAKER_PROXY,
            ["preCheck"],
            true
        );
        await setExplicitAccess(
            TEMPLE_V2_INSTANCES.TEMPLE_LINE_OF_CREDIT.CIRCUIT_BREAKERS.TEMPLE,
            TEMPLE_V2_ADDRESSES.CORE.CIRCUIT_BREAKER_PROXY,
            ["preCheck"],
            true
        );
    }

    // Set TLC strategy
    {   
        const debtCeiling: ITempleStrategy.AssetBalanceStruct[] = [
            {
                asset: TEMPLE_V2_ADDRESSES.EXTERNAL.MAKER_DAO.DAI_TOKEN,
                balance: ethers.utils.parseEther("2500000") // 2.5mm
            },
            // TLC doesn't borrow Temple, but it does need to repay temple on liquidations
            {
                asset: TEMPLE_V2_ADDRESSES.CORE.TEMPLE_TOKEN,
                balance: 0
            }
        ];

        await mine(TEMPLE_V2_INSTANCES.TREASURY_RESERVES_VAULT.INSTANCE.addStrategy(
            TEMPLE_V2_ADDRESSES.STRATEGIES.TLC_STRATEGY.ADDRESS,
            0, // underperformingEquityThreeshold
            debtCeiling
        ));

        await mine(TEMPLE_V2_INSTANCES.TEMPLE_LINE_OF_CREDIT.INSTANCE.setTlcStrategy(TEMPLE_V2_ADDRESSES.STRATEGIES.TLC_STRATEGY.ADDRESS));
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