import "@nomiclabs/hardhat-ethers";
import { ethers, network } from "hardhat";
import { BigNumber } from "ethers";
import {
    RAMOSGoerli,
    RAMOSGoerli__factory
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

const { TEMPLE50_FRAX50_POOL_ID, TEMPLE_INDEX_IN_POOL } = amoAddresses.goerli.others;
const { BALANCER_VAULT } = amoAddresses.goerli.contracts;
const { FRAX, TEMPLE50_FRAX50_TOKEN } = amoAddresses.goerli.tokens;


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

    const amoFactory: RAMOSGoerli__factory = new RAMOSGoerli__factory(owner);
    const amo: RAMOSGoerli = await deployAndMine(
        "RAMOSGoerli", amoFactory, amoFactory.deploy,
        BALANCER_VAULT,
        DEPLOYED.TEMPLE,
        FRAX,
        TEMPLE50_FRAX50_TOKEN,
        BigNumber.from(TEMPLE_INDEX_IN_POOL),
        TEMPLE50_FRAX50_POOL_ID
    );

    // post deploy
    await mine(amo.setOperator(DEPLOYED.MULTISIG));
    await mine(amo.setCoolDown(1800))
    await mine(amo.setTemplePriceFloorNumerator(9_700));
    await mine(amo.setRebalancePercentageBounds(100, 300));
    await mine(amo.setMaxRebalanceAmounts(toAtto(50_000), toAtto(50_000), toAtto(50_000)));
    await mine(amo.setPostRebalanceSlippage(500));
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
