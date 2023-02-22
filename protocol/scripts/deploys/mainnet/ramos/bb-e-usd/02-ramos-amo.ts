import "@nomiclabs/hardhat-ethers";
import { ethers, network } from "hardhat";
import { BigNumber } from "ethers";
import {
    RAMOS,
    RAMOS__factory
} from "../../../../../typechain";
import {
  deployAndMine,
  DEPLOYED_CONTRACTS, 
  DeployedContracts,
  ensureExpectedEnvvars,
  mine,
  toAtto
} from "../../../helpers";

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
        DEPLOYED.BALANCER_VAULT,
        DEPLOYED.TEMPLE,
        DEPLOYED.BB_E_USD_TOKEN,
        DEPLOYED.TEMPLE_BB_E_USD_LP_TOKEN,
        DEPLOYED.RAMOS_BB_E_USD_AURA_STAKING,
        BigNumber.from(0),
        DEPLOYED.TEMPLE_BB_E_USD_BALANCER_POOL_ID
    );

    // post deploy
    await mine(ramos.setOperator("0x628a05f7dc7356349813b6e1ef74caa8069eea19")); // The bot relayer wallet
    await mine(ramos.setCoolDown(1_800)); // 30 mins
    await mine(ramos.setTemplePriceFloorNumerator(9_883));
    await mine(ramos.setRebalancePercentageBounds(100, 300));  // rebalance_up if 1% below, rebalance_down if 3% above
    await mine(ramos.setMaxRebalanceAmounts(toAtto(1_000_000), toAtto(1_000_000), toAtto(1_000_000))); // 1Mill max on each
    await mine(ramos.setPostRebalanceSlippage(5_000)); // 50%
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
