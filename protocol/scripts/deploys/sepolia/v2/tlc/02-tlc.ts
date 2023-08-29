import '@nomiclabs/hardhat-ethers';
import { ethers } from 'hardhat';
import { TempleLineOfCredit__factory } from '../../../../../typechain';
import {
  deployAndMine,
  ensureExpectedEnvvars,
} from '../../../helpers';
import { getDeployedContracts } from '../contract-addresses';

async function main() {
  ensureExpectedEnvvars();
  const [owner] = await ethers.getSigners();
  const TEMPLE_V2_ADDRESSES = getDeployedContracts();

  const tlcFactory = new TempleLineOfCredit__factory(owner);
  await deployAndMine(
    'TEMPLE_LINE_OF_CREDIT.ADDRESS',
    tlcFactory,
    tlcFactory.deploy,
    TEMPLE_V2_ADDRESSES.CORE.RESCUER_MSIG,
    await owner.getAddress(),
    TEMPLE_V2_ADDRESSES.CORE.CIRCUIT_BREAKER_PROXY,
    TEMPLE_V2_ADDRESSES.CORE.TEMPLE_TOKEN,
    TEMPLE_V2_ADDRESSES.EXTERNAL.MAKER_DAO.DAI_TOKEN,
    ethers.utils.parseEther('0.8'), // 80% max LTV ratio
    TEMPLE_V2_ADDRESSES.TEMPLE_LINE_OF_CREDIT.INTEREST_RATE_MODELS.LINEAR_WITH_KINK
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