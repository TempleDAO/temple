import {
    runAsyncMain,
    mine,
} from '../../../helpers';
import { getDeployContext } from '../deploy-context';

async function main() {
    const { ADDRS, INSTANCES } = await getDeployContext(__dirname);

    // Transfer ownership of TGLD to executor msig
    // Originally, ownership was intended for the TempleGoldAdmin contract. But executor is handling this well now.
    await mine(INSTANCES.TEMPLE_GOLD.TEMPLE_GOLD.transferOwnership(ADDRS.CORE.EXECUTOR_MSIG));
    // Transfer ownership of Spice factory to executor msig
    await mine(INSTANCES.TEMPLE_GOLD.SPICE_AUCTION_FACTORY.proposeNewExecutor(ADDRS.CORE.EXECUTOR_MSIG));
}
  
runAsyncMain(main);
