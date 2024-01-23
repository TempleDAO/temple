import '@nomiclabs/hardhat-ethers';
import { ethers } from 'hardhat';
import { TlcStrategy__factory } from '../../../../../typechain';
import {
  deployAndMine,
  ensureExpectedEnvvars,
} from '../../../helpers';
import { getDeployedContracts } from '../contract-addresses';

async function main() {
  ensureExpectedEnvvars();
  const [owner] = await ethers.getSigners();
  const TEMPLE_V2_ADDRESSES = getDeployedContracts();

  const tlcStrategyFactory = new TlcStrategy__factory(owner);
  await deployAndMine(
    'STRATEGIES.TLC_STRATEGY.ADDRESS',
    tlcStrategyFactory,
    tlcStrategyFactory.deploy,
    TEMPLE_V2_ADDRESSES.CORE.RESCUER_MSIG,
    await owner.getAddress(),
    "TlcStrategy",
    TEMPLE_V2_ADDRESSES.TREASURY_RESERVES_VAULT.ADDRESS,
    TEMPLE_V2_ADDRESSES.TEMPLE_LINE_OF_CREDIT.ADDRESS,
    TEMPLE_V2_ADDRESSES.EXTERNAL.MAKER_DAO.DAI_TOKEN
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