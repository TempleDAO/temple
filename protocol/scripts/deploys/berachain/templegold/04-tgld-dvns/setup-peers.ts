import { TempleGold__factory } from '../../../../../typechain';
import { runAsyncMain } from '../../../helpers';
import { DEFAULT_SETTINGS as MAINNET_DEFAULT_SETTINGS } from '../../../mainnet/templegold/default-settings';
import { CONTRACTS as MAINNET_ADDRS} from '../../../mainnet/templegold/contract-addresses/mainnet';
import { setPeer } from '../../../layer-zero-utils';
import { getDeployContext } from '../deploy-context';

async function main() {
    const {owner, ADDRS } = await getDeployContext(__dirname);
    const oft = TempleGold__factory.connect(ADDRS.TEMPLE_GOLD.TEMPLE_GOLD, owner);
    await setPeer(oft, MAINNET_DEFAULT_SETTINGS.GLOBAL.LZ_EID, MAINNET_ADDRS.TEMPLE_GOLD.TEMPLE_GOLD);
}

runAsyncMain(main);
