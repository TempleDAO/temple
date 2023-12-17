import '@nomiclabs/hardhat-ethers';
import { ethers } from 'hardhat';
import { PartnerZeroSacrifice__factory } from '../../../../typechain';
import {
  deployAndMine,
  ensureExpectedEnvvars
} from '../../helpers';
import { getDeployedContracts } from "./contract-addresses";

async function main() {
    ensureExpectedEnvvars();
    const [owner] = await ethers.getSigners();
    const deployedContracts = getDeployedContracts();

    const partnerSacrifice = new PartnerZeroSacrifice__factory(owner);
    const executor = await owner.getAddress();
    await deployAndMine(
        'NEXUS.PARTNER_ZERO_SACRIFICE',
        partnerSacrifice,
        partnerSacrifice.deploy,
        deployedContracts.NEXUS.RELIC,
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