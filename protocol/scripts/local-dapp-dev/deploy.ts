import '@nomiclabs/hardhat-ethers';
import { BigNumber, ContractTransaction } from 'ethers';
import { ethers } from 'hardhat';
import { blockTimestamp } from '../../test/helpers';
import {
  Faith__factory,
  FakeERC20__factory,
  OGTemple__factory,
  TempleERC20Token__factory,
  TempleStaking__factory,
  JoiningFee__factory,
  OpsManager__factory,
  VaultProxy__factory,
  InstantExitQueue__factory,
  LockedOGTemple__factory,
} from '../../typechain';
import { zeroAddress } from 'ethereumjs-util';

function toAtto(n: number) {
  return BigNumber.from(10)
    .pow(18)
    .mul(n);
}

async function extractDeployedAddress(
  tx: ContractTransaction,
  eventName: string
): Promise<string> {
  let result = 'FAILED TO FIND';
  await tx.wait(0).then(receipt => {
    const event = receipt.events?.filter(evt => {
      if (evt.event) {
        return evt.event === eventName;
      }
    })[0];

    if (event?.args) {
      result = event.args[0];
    }
  });

  return result;
}

async function main() {
  const [owner, account1, account2] = await ethers.getSigners();

  // ERC20 Tokens
  const templeToken = await new TempleERC20Token__factory(owner).deploy();
  const dai = await new FakeERC20__factory(owner).deploy('DAI', 'DAI', zeroAddress(), 0);
  const accounts = await ethers.getSigners();
  for (const account of accounts.slice(0, 5)) {
    const address = await account.getAddress();
    await dai.mint(address, toAtto(15000));
  }
  await templeToken.addMinter(await owner.getAddress()); // useful for tests for owner to be able to mint temple

  // Legacy Temple Staking
  const startEpochSeconds = await blockTimestamp();
  const epochSizeSeconds = 24 * 60 * 60;
  const templeStaking = await new TempleStaking__factory(owner).deploy(
    templeToken.address,
    templeToken.address, // set exit queue parameter to bad address, update it with instant exit queue later
    epochSizeSeconds /* epoch size, in blocks */,
    startEpochSeconds
  );
  await templeStaking.setEpy(80, 10000);
  const instantExitQueue = await new InstantExitQueue__factory(owner).deploy(
    templeStaking.address,
    templeToken.address
  );
  await templeStaking.setExitQueue(instantExitQueue.address);
  const ogTempleToken = new OGTemple__factory(owner).attach(
    await templeStaking.OG_TEMPLE()
  );
  const lockedOgTemple = await new LockedOGTemple__factory(owner).deploy(
    ogTempleToken.address
  );

  // stake, lock and exit some temple
  let nLocks = 2;
  for (const account of accounts.slice(0, 5)) {
    const address = await account.getAddress();
    await templeToken.mint(address, toAtto(30000));
    await templeToken
      .connect(account)
      .increaseAllowance(templeStaking.address, toAtto(20000));
    await templeStaking.connect(account).stake(toAtto(20000)); // stake a bunch, leave some free temple await ogTempleToken
    await ogTempleToken
      .connect(account)
      .increaseAllowance(lockedOgTemple.address, toAtto(10000));
    await ogTempleToken
      .connect(account)
      .increaseAllowance(templeStaking.address, toAtto(10000));
    const nOgTemple = (await ogTempleToken.balanceOf(address)).div(2); // only lock half

    // Lock temple, and unstake some, so it's in the exit queue
    const lockedUntil = await blockTimestamp();
    for (let i = 0; i < nLocks; i++) {
      await lockedOgTemple
        .connect(account)
        .lock(nOgTemple.div(nLocks).sub(1), lockedUntil + i * 600);
      await templeStaking.connect(account).unstake(nOgTemple.div(nLocks * 2));
    }
    nLocks += 1;
  }

  // Faith (for Vaults)
  const faith = await new Faith__factory(owner).deploy();
  await faith.addManager(await owner.getAddress());
  await faith.gain(await account1.getAddress(), toAtto(10000));
  await faith.gain(await account2.getAddress(), toAtto(5000));

  // Vaults
  const joiningFee = await new JoiningFee__factory(owner).deploy(
    100000000000000
  );
  const opsManagerLib = await (await ethers.getContractFactory('OpsManagerLib'))
    .connect(owner)
    .deploy();
  const opsManager = await new OpsManager__factory(
    { 'contracts/core/OpsManagerLib.sol:OpsManagerLib': opsManagerLib.address },
    owner
  ).deploy(templeToken.address, joiningFee.address);

  const THIRTY_MINUTES = 30 * 60;
  const FIVE_MINUTES = 5 * 60;
  const period = Number(process.env.E2E_TEST_DEPLOY_PERIOD) || THIRTY_MINUTES;
  const window = Number(process.env.E2E_TEST_DEPLOY_WINDOW) || FIVE_MINUTES;
  const numberOfSubVaults = period / window;
  if (period % window)
    throw new Error('Vault period should divide perfectly by vault window');

  for (let i = 0; i < numberOfSubVaults; i++) {
    const vaultTx = await opsManager.createVaultInstance(
      'temple-1m-vault',
      'TPL-1M-V1',
      period,
      window,
      { p: 1, q: 1 },
      Math.floor(Date.now() / 1000) + i * window
    );
    const vault = await extractDeployedAddress(vaultTx, 'CreateVaultInstance');
    console.log(vault);
  }

  const vaultProxy = await new VaultProxy__factory(owner).deploy(
    ogTempleToken.address,
    templeToken.address,
    templeStaking.address,
    faith.address
  );
  await templeToken.mint(vaultProxy.address, toAtto(1000000));
  await faith.addManager(vaultProxy.address);
  const vaultedTempleAddr = await opsManager.vaultedTemple();

  // Print config required to run dApp
  const contract_address: { [key: string]: string } = {
    INSTANT_EXIT_QUEUES: instantExitQueue.address,
    TEMPLE_STAKING: templeStaking.address,
    FAITH: faith.address,
    VAULT_OPS_MANAGER: opsManager.address,
    VAULT_PROXY: vaultProxy.address,
    VAULTED_TEMPLE: vaultedTempleAddr,
    LOCKED_OGTEMPLE: lockedOgTemple.address,
    OGTEMPLE: ogTempleToken.address,
    DAI: dai.address,
    TEMPLE: templeToken.address,
  };

  console.log('\n=========================================');
  console.log('*** Deployed contract addresses:\n\n');
  for (const envvar in contract_address) {
    console.log(`${envvar} = ${contract_address[envvar]}`);
  }
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
