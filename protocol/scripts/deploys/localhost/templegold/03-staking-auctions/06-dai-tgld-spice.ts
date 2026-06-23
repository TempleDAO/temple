import '@nomiclabs/hardhat-ethers';
import {
  mine,
  runAsyncMain,
} from '../../../helpers';
import { getLocalhostDeployContext } from '../deploy-context';

async function main() {
  const { INSTANCES, ADDRS } = await getLocalhostDeployContext(__dirname);
  const name = 'DAI_TGLD_SPICE_AUCTION';
  await mine(INSTANCES.TEMPLE_GOLD.SPICE_AUCTION_FACTORY.createAuction(ADDRS.EXTERNAL.MAKER_DAO.DAI_TOKEN, name));
  console.log(`${name} = ${await INSTANCES.TEMPLE_GOLD.SPICE_AUCTION_FACTORY.deployedAuctions(ADDRS.EXTERNAL.MAKER_DAO.DAI_TOKEN, 1)}`);
}

runAsyncMain(main);
