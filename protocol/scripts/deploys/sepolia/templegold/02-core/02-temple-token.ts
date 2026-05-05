import '@nomiclabs/hardhat-ethers';
import { ethers } from 'hardhat';
import { FakeERC20__factory } from '../../../../../typechain';
import {
  deployAndMine,
  ensureExpectedEnvvars,
  toAtto,
} from '../../../helpers';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { DEFAULT_SETTINGS } from '../default-settings';

async function main() {
    ensureExpectedEnvvars();
    const [owner] = await ethers.getSigners();
    
    await _deployTempleToken(owner);
}
  
async function _deployTempleToken(owner: SignerWithAddress) {
    const factory = new FakeERC20__factory(owner);
    await deployAndMine(
        'TEMPLE_TOKEN',
        factory,
        factory.deploy,
        DEFAULT_SETTINGS.TEMPLE_TOKEN.NAME,
        DEFAULT_SETTINGS.TEMPLE_TOKEN.SYMBOL,
        await owner.getAddress(),
        toAtto(Number(DEFAULT_SETTINGS.TEMPLE_TOKEN.INITIAL_MINT))
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
