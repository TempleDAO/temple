import {
    mine,
    runAsyncMain,
} from '../../../helpers';
import { getDeployContext } from '../deploy-context';

async function main() {
    const { ADDRS, INSTANCES } = await getDeployContext(__dirname);

    await mine(INSTANCES.TEMPLE_GOLD.TEMPLE_GOLD.transferOwnership(ADDRS.CORE.EXECUTOR_MSIG));
    await mine(INSTANCES.TEMPLE_GOLD.SPICE_AUCTION_FACTORY.proposeNewExecutor(ADDRS.CORE.EXECUTOR_MSIG));
}
  
runAsyncMain(main);
