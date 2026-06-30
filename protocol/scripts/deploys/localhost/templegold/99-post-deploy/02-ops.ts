import '@nomiclabs/hardhat-ethers';
import { TempleGoldStaking__factory, FakeERC20__factory } from '../../../../../typechain';
import {
  toAtto,
  mine,
  runAsyncMain,
} from '../../../helpers';
import { getLocalhostDeployContext } from '../deploy-context';

async function main() {
    const { owner, ADDRS } = await getLocalhostDeployContext(__dirname);
    const staking = TempleGoldStaking__factory.connect(ADDRS.TEMPLE_GOLD.TEMPLE_GOLD_STAKING, owner);
    const templeToken = FakeERC20__factory.connect(ADDRS.CORE.TEMPLE_TOKEN, owner);

    const amount = toAtto(100_000);
    await mine(templeToken.approve(ADDRS.TEMPLE_GOLD.TEMPLE_GOLD_STAKING, amount));
    await mine(templeToken.mint(await owner.getAddress(), amount));
    await mine(staking.stake(toAtto(1)));
}

runAsyncMain(main);
