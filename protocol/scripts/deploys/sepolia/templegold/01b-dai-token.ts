import '@nomiclabs/hardhat-ethers';
import { ethers } from 'hardhat';
import { FakeERC20__factory } from '../../../../typechain';
import {
  deployAndMine,
  ensureExpectedEnvvars,
  toAtto,
} from '../../helpers';

async function main() {
    ensureExpectedEnvvars();
    const [owner] = await ethers.getSigners();
    
    const factory = new FakeERC20__factory(owner);
    await deployAndMine(
        'DAI_TOKEN',
        factory,
        factory.deploy,
        "Dai Token",
        "DAI",
        await owner.getAddress(),
        toAtto(100_000)
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