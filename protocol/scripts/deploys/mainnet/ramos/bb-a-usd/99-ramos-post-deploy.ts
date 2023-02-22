import "@nomiclabs/hardhat-ethers";
import { ethers, network } from "hardhat";
import {
    AuraStaking,
    AuraStaking__factory,
  RAMOS, RAMOS__factory
} from "../../../../../typechain";
import {
  DEPLOYED_CONTRACTS, 
  DeployedContracts,
  ensureExpectedEnvvars,
  mine
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

    const auraStaking = AuraStaking__factory.connect(DEPLOYED.RAMOS_BB_A_USD_AURA_STAKING, owner);
    const ramos = RAMOS__factory.connect(DEPLOYED.RAMOS_BB_A_USD, owner);

    await ramosPostDeploy(ramos, DEPLOYED);
    await stakingPostDeploy(auraStaking, DEPLOYED);
}

async function ramosPostDeploy(ramos: RAMOS, DEPLOYED: DeployedContracts) {
    await mine(ramos.setPoolHelper(DEPLOYED.RAMOS_BB_A_USD_POOL_HELPER));

    await mine(ramos.transferOwnership(DEPLOYED.MULTISIG));
}
 
 async function stakingPostDeploy(auraStaking: AuraStaking, DEPLOYED: DeployedContracts) {
    await mine(auraStaking.setOperator(DEPLOYED.RAMOS_BB_A_USD));
    await mine(auraStaking.setAuraPoolInfo(
        parseInt(DEPLOYED.TEMPLE_BB_A_USD_AURA_POOL_ID), 
        DEPLOYED.TEMPLE_BB_A_USD_AURA_STAKING_DEPOSIT_TOKEN, 
        DEPLOYED.TEMPLE_BB_A_USD_REWARDS,
    ));

    // will sit in auraStaking contract until set. leave for multisig to decide
    // await mine(auraStaking.setRewardsRecipient());

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