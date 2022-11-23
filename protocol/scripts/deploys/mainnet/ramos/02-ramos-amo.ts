import "@nomiclabs/hardhat-ethers";
import { ethers, network } from "hardhat";
import { BigNumber } from "ethers";
import {
    RAMOS,
    RAMOS__factory
} from "../../../../typechain";
import {
  deployAndMine,
  DEPLOYED_CONTRACTS, 
  DeployedContracts,
  ensureExpectedEnvvars,
  mine,
  toAtto
} from "../../helpers";
import amoAddresses from "../../../../test/amo/amo-constants";

const { TEMPLE_BB_A_USD_BALANCER_POOL_ID, TEMPLE_INDEX_IN_POOL } = amoAddresses.mainnet.others;
const { BALANCER_VAULT, AURA_BOOSTER } = amoAddresses.mainnet.contracts;
const { BBA_USD_TOKEN, TEMPLE_BBAUSD_LP_TOKEN } = amoAddresses.mainnet.tokens;


async function main() {
    ensureExpectedEnvvars();
    const [owner] = await ethers.getSigners();

    let DEPLOYED: DeployedContracts;

    if (DEPLOYED_CONTRACTS[network.name] === undefined) {
        console.log(`No contracts configured for ${network.name}`);
        return;
    } else {
        DEPLOYED = DEPLOYED_CONTRACTS[network.name];
    }

    const ramosFactory: RAMOS__factory = new RAMOS__factory(owner);
    const ramos: RAMOS = await deployAndMine(
        "RAMOS", ramosFactory, ramosFactory.deploy,
        BALANCER_VAULT,
        DEPLOYED.TEMPLE,
        BBA_USD_TOKEN,
        TEMPLE_BBAUSD_LP_TOKEN,
        DEPLOYED.RAMOS_AURA_STAKING,
        AURA_BOOSTER,
        BigNumber.from(TEMPLE_INDEX_IN_POOL),
        TEMPLE_BB_A_USD_BALANCER_POOL_ID
    );

    // post deploy
    await mine(ramos.setOperator(DEPLOYED.MULTISIG));
    await mine(ramos.setCoolDown(1800))
    await mine(ramos.setTemplePriceFloorNumerator(9_700));
    await mine(ramos.setRebalancePercentageBounds(100, 300));
    await mine(ramos.setMaxRebalanceAmounts(toAtto(50_000), toAtto(50_000), toAtto(50_000)));
    await mine(ramos.setPostRebalanceSlippage(500));
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
