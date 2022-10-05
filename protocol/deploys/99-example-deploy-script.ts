import '@nomiclabs/hardhat-ethers';
import { ethers, network } from 'hardhat';

import { DEPLOYED_CONTRACTS } from '../contract-addresses';

import { deployAndMine, ensureExpectedEnvvars, mine } from './helpers';
import { BigNumber } from 'ethers';

async function main() {
  const deployedContracts = DEPLOYED_CONTRACTS[network.name];
  const args: {
    CONSTRUCTOR_ARG_1: string;
    CONSTRUCTOR_ARG_2: string;
    VESTING_DURATION: string;
  } = {
    CONSTRUCTOR_ARG_1: '';
    CONSTRUCTOR_ARG_2: '';
    VESTING_DURATION: '',
  }
  ensureExpectedEnvvars(args);

  const [owner] = await ethers.getSigners();

  const someSmartContractFactory = new SomeSmartContract__factory(owner)
  const someSmartContract: Presale = await deployAndMine("PRESALE", someSmartContractFactory, someSmartContractFactory.deploy,
    BigNumber.from(args.HARD_CAP),
    BigNumber.from(args.HURDLE),
    BigNumber.from(args.VESTING_DURATION),
    deployedContracts.DAO_MULTISIG,
  );

  await mine(someSmartContract.transferOwnership(deployedContracts.DAO_MULTISIG));
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
