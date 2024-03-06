import '@nomiclabs/hardhat-ethers';
import { ethers } from 'hardhat';
import { MultiOtcOffer__factory } from '../../../../../typechain';
import {
  deployAndMine,
  ensureExpectedEnvvars,
} from '../../../helpers';
import { getDeployedContracts } from '../contract-addresses';


async function main() {
    ensureExpectedEnvvars();
    const [owner] = await ethers.getSigners();
    const CORE_ADDRESSES = getDeployedContracts();
    const initialRescuer = CORE_ADDRESSES.CORE.RESCUER_MSIG;
    const factory = new MultiOtcOffer__factory(owner);
    await deployAndMine(
        'STRATEGIES.FOHMO_GNOSIS_STRATEGY.OTC_OFFER.MULTI_OTC_MARKET_OFFER',
        factory,
        factory.deploy,
        initialRescuer,
        await owner.getAddress(),
    );
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });