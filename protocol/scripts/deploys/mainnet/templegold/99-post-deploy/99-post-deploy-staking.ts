import { ethers } from 'hardhat';
import {
    ensureExpectedEnvvars,
    mine,
} from '../../../helpers';
import { connectToContracts, getDeployedContracts } from '../contract-addresses';
import { DEFAULT_SETTINGS } from '../default-settings';

async function main() {
    ensureExpectedEnvvars();
    const [owner] = await ethers.getSigners();
    const ADDRS = getDeployedContracts();
    const INSTANCES = connectToContracts(owner);

    // reward duration
    await mine(INSTANCES.TEMPLE_GOLD.TEMPLE_GOLD_STAKING.setRewardDuration(DEFAULT_SETTINGS.STAKING.REWARDS_DURATION));
    // distribution starter
    await mine(INSTANCES.TEMPLE_GOLD.TEMPLE_GOLD_STAKING.setDistributionStarter(ADDRS.TEMPLE_GOLD.STAKING_AUTOMATION_EOA));
    // rewards distribution cool down
    await mine(INSTANCES.TEMPLE_GOLD.TEMPLE_GOLD_STAKING.setRewardDistributionCoolDown(DEFAULT_SETTINGS.STAKING.REWARDS_COOLDOWN));
    // unstake cool down
    await mine(INSTANCES.TEMPLE_GOLD.TEMPLE_GOLD_STAKING.setUnstakeCooldown(DEFAULT_SETTINGS.STAKING.UNSTAKE_COOLDOWN));
}
  
// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });
