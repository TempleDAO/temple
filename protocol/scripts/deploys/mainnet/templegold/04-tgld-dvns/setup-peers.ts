import { TempleGold__factory } from '../../../../../typechain';
import { runAsyncMain } from '../../../helpers';
import { DEFAULT_SETTINGS as BERACHAIN_DEFAULT_SETTINGS } from '../../../berachain/templegold/default-settings';
import { CONTRACTS as BERACHAIN_ADDRS} from '../../../berachain/templegold/contract-addresses/berachain';
import { setPeer } from '../../../layer-zero-utils';
import { getDeployContext } from '../deploy-context';

async function main() {
    const { owner, ADDRS } = await getDeployContext(__dirname);
    const oft = TempleGold__factory.connect(ADDRS.TEMPLE_GOLD.TEMPLE_GOLD, owner);
    await setPeer(oft, BERACHAIN_DEFAULT_SETTINGS.GLOBAL.LZ_EID, BERACHAIN_ADDRS.TEMPLE_GOLD.TEMPLE_GOLD);
}

runAsyncMain(main);
