import "@nomiclabs/hardhat-ethers";
import { ethers, network } from "hardhat";
import {
  AuraStaking,
  AuraStaking__factory,
  RAMOS, RAMOS__factory,
} from "../../../../../typechain";
import {
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

    const auraStaking = AuraStaking__factory.connect(DEPLOYED.RAMOS_DAI_AURA_STAKING, owner);
    const ramos = RAMOS__factory.connect(DEPLOYED.RAMOS_DAI, owner);

    await ramosPostDeploy(ramos, DEPLOYED);
    await stakingPostDeploy(auraStaking, DEPLOYED);
    await transferOwnership(ramos, auraStaking, DEPLOYED);
}

async function ramosPostDeploy(ramos: RAMOS, DEPLOYED: DeployedContracts) {
    await mine(ramos.setOperator("0x628a05f7dc7356349813b6e1ef74caa8069eea19")); // The bot relayer wallet
    await mine(ramos.setCoolDown(1_800)); // 30 mins
    await mine(ramos.setTemplePriceFloorNumerator(10_200)); // $1.02
    await mine(ramos.setRebalancePercentageBounds(100, 1_000));  // rebalance_up if 1% below, rebalance_down if 10% above
    await mine(ramos.setMaxRebalanceAmounts(toAtto(1_000_000), toAtto(1_000_000), toAtto(1_000_000))); // 1Mill max on each
    await mine(ramos.setPostRebalanceSlippage(5_000)); // 50%
    await mine(ramos.setPoolHelper(DEPLOYED.RAMOS_DAI_POOL_HELPER));
}
 
 async function stakingPostDeploy(auraStaking: AuraStaking, DEPLOYED: DeployedContracts) {
    await mine(auraStaking.setOperator(DEPLOYED.RAMOS_DAI));
    await mine(auraStaking.setAuraPoolInfo(
        parseInt(DEPLOYED.TEMPLE_DAI_AURA_POOL_ID), 
        DEPLOYED.TEMPLE_DAI_AURA_STAKING_DEPOSIT_TOKEN, 
        DEPLOYED.TEMPLE_DAI_REWARDS,
    ));
    await mine(auraStaking.setRewardsRecipient(DEPLOYED.FARM_MULTISIG));
}
 
async function transferOwnership(ramos: RAMOS, auraStaking: AuraStaking, DEPLOYED: DeployedContracts) {
    await mine(ramos.transferOwnership(DEPLOYED.MULTISIG));
    await mine(auraStaking.transferOwnership(DEPLOYED.MULTISIG));
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
.then(() => process.exit(0))
.catch((error) => {
  console.error(error);
  process.exit(1);
});