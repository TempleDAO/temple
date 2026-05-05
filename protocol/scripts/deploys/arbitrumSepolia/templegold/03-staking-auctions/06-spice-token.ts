import '@nomiclabs/hardhat-ethers';
import { ethers } from 'hardhat';
import { FakeERC20__factory } from '../../../../../typechain';
import {
  deployAndMine,
  ensureExpectedEnvvars,
  toAtto,
} from '../../../helpers';
import { DEFAULT_SETTINGS } from '../default-settings';

async function main() {
    ensureExpectedEnvvars();
    const [owner] = await ethers.getSigners();
    
    const factory = new FakeERC20__factory(owner);
    await deployAndMine(
        'SPICE_TOKEN',
        factory,
        factory.deploy,
        DEFAULT_SETTINGS.SPICE.TOKEN_A.NAME,
        DEFAULT_SETTINGS.SPICE.TOKEN_A.SYMBOL,
        await owner.getAddress(),
        toAtto(Number(DEFAULT_SETTINGS.SPICE.TOKEN_A.INITIAL_MINT))
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
