import {
    mine,
    runAsyncMain
} from '../../../helpers';
import { getDeployContext } from '../deploy-context';

async function main() {
    const { owner, ADDRS, INSTANCES } = await getDeployContext(__dirname);

    // Transfer ownership of TGLD to executor msig
    await mine(INSTANCES.TEMPLE_GOLD.TEMPLE_GOLD.transferOwnership(ADDRS.CORE.EXECUTOR_MSIG));
    // Transfer ownership of Spice factory to executor msig
    await mine(INSTANCES.TEMPLE_GOLD.SPICE_AUCTION_FACTORY.proposeNewExecutor(ADDRS.CORE.EXECUTOR_MSIG));
}
  
runAsyncMain(main);
