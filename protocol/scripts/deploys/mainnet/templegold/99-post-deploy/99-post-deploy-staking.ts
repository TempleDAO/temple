import {
    mine,
    runAsyncMain,
} from '../../../helpers';
import { DEFAULT_SETTINGS } from '../default-settings';
import { getDeployContext } from '../deploy-context';

async function main() {
    const { ADDRS, INSTANCES } = await getDeployContext(__dirname);

    // reward duration
    await mine(INSTANCES.TEMPLE_GOLD.TEMPLE_GOLD_STAKING.setRewardDuration(DEFAULT_SETTINGS.STAKING.REWARDS_DURATION));
    // distribution starter
    await mine(INSTANCES.TEMPLE_GOLD.TEMPLE_GOLD_STAKING.setDistributionStarter(ADDRS.TEMPLE_GOLD.STAKING_AUTOMATION_EOA));
    // rewards distribution cool down
    await mine(INSTANCES.TEMPLE_GOLD.TEMPLE_GOLD_STAKING.setRewardDistributionCoolDown(DEFAULT_SETTINGS.STAKING.REWARDS_COOLDOWN));
    // unstake cool down
    await mine(INSTANCES.TEMPLE_GOLD.TEMPLE_GOLD_STAKING.setUnstakeCooldown(DEFAULT_SETTINGS.STAKING.UNSTAKE_COOLDOWN));
}

runAsyncMain(main);
