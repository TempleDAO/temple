import '@nomiclabs/hardhat-ethers';
import { ethers, network } from 'hardhat';
import { PartnerZeroSacrifice__factory } from '../../../../typechain';
import {
  deployAndMine,
  ensureExpectedEnvvars,
  DEPLOYED_CONTRACTS
} from '../../helpers';

async function main() {
    ensureExpectedEnvvars();
    const [owner] = await ethers.getSigners();
    const relicAddress = DEPLOYED_CONTRACTS[network.name].RELIC;

    const partnerSacrifice = new PartnerZeroSacrifice__factory(owner);
    const executor = await owner.getAddress();
    await deployAndMine(
        'PARTNER_ZERO_SACRIFICE',
        partnerSacrifice,
        partnerSacrifice.deploy,
        relicAddress,
        executor
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