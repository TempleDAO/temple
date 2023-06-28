import '@nomiclabs/hardhat-ethers';
import { ethers } from 'hardhat';
import { TempleLineOfCredit__factory } from '../../../../typechain';
import {
  deployAndMine,
  ensureExpectedEnvvars,
} from '../../helpers';
import { getDeployedContracts } from './contract-addresses';

async function main() {
  ensureExpectedEnvvars();
  const [owner] = await ethers.getSigners();
  const TEMPLE_V2_DEPLOYED = getDeployedContracts();

  const tlcFactory = new TempleLineOfCredit__factory(owner);
  await deployAndMine(
    'TEMPLE_LINE_OF_CREDIT',
    tlcFactory,
    tlcFactory.deploy,
    await owner.getAddress(),
    await owner.getAddress(),
    TEMPLE_V2_DEPLOYED.CORE.CIRCUIT_BREAKER_PROXY,
    TEMPLE_V2_DEPLOYED.CORE.TEMPLE_TOKEN,
    TEMPLE_V2_DEPLOYED.EXTERNAL.MAKER_DAO.DAI_TOKEN,
    -1, // TODO: update value
    TEMPLE_V2_DEPLOYED.TEMPLE_LINE_OF_CREDIT.INTEREST_RATE_MODELS.LINEAR_WITH_KINK
  )

}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });