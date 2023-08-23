import '@nomiclabs/hardhat-ethers';
import { ethers } from 'hardhat';
import { DsrBaseStrategyTestnet__factory } from '../../../../../typechain';
import {
  deployAndMine,
  ensureExpectedEnvvars,
} from '../../../helpers';
import { getDeployedContracts } from '../contract-addresses';

async function main() {
  ensureExpectedEnvvars();
  const [owner] = await ethers.getSigners();
  const TEMPLE_V2_ADDRESSES = getDeployedContracts();

  const dsrBaseStrategyFactory = new DsrBaseStrategyTestnet__factory(owner);
  await deployAndMine(
    'STRATEGIES.DSR_BASE_STRATEGY.ADDRESS',
    dsrBaseStrategyFactory,
    dsrBaseStrategyFactory.deploy,
    TEMPLE_V2_ADDRESSES.CORE.RESCUER_MSIG,
    await owner.getAddress(),
    "DsrBaseStrategy",
    TEMPLE_V2_ADDRESSES.TREASURY_RESERVES_VAULT.ADDRESS,
    TEMPLE_V2_ADDRESSES.EXTERNAL.MAKER_DAO.DAI_TOKEN,
    ethers.utils.parseEther('0.0349')
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