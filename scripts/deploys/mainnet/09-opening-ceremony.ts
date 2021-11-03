import '@nomiclabs/hardhat-ethers';
import { ethers, network } from 'hardhat';
import { OpeningCeremony, OpeningCeremony__factory, Presale__factory, TempleERC20Token__factory, TempleStaking__factory, TempleTreasury__factory, TreasuryManagementProxy__factory } from '../../../typechain';
import { deployAndMine, DeployedContracts, DEPLOYED_CONTRACTS, fromAtto, toAtto } from '../helpers';

const EPOCH_SIZE = 24 * 60 * 60;
const START_TIMESTAMP = 1632880800; // Wednesday, September 29, 2021 2:00:00 AM UTC
const UNLOCK_TIMESTAMP = 1637236800; // Thursday, November 18, 2021 12:00:00 PM UTC
const MAX_EXITABLE_PER_ADDRESS = toAtto(1000) ;
const MAX_EXITABLE_PER_EPOCH = toAtto(1000) ;
const MINT_MULTIPLE = 6;

async function main() {
  const [owner] = await ethers.getSigners();

  let DEPLOYED: DeployedContracts;

  if (DEPLOYED_CONTRACTS[network.name] === undefined) {
    console.log(`No contracts configured for ${network.name}`)
    return;
  } else {
    DEPLOYED = DEPLOYED_CONTRACTS[network.name];
  }

  const treasury = new TempleTreasury__factory(owner).attach(DEPLOYED.TREASURY);
  const templeToken = new TempleERC20Token__factory(owner).attach(DEPLOYED.TEMPLE);
  const presale = new Presale__factory(owner).attach(DEPLOYED.PRESALE);
  const staking = new TempleStaking__factory(owner).attach(DEPLOYED.STAKING);

  const treasuryManagementProxyFactory = new TreasuryManagementProxy__factory(owner);
  const treasuryManagementProxy = await deployAndMine(
    'TREASURY_MANAGEMENT', treasuryManagementProxyFactory, treasuryManagementProxyFactory.deploy,
    await owner.getAddress(),
    DEPLOYED.TREASURY,
  );

  console.log();
  console.log("Transfer treasury ownership over to newly created contract");
  await treasury.transferOwnership(treasuryManagementProxy.address)

  const openingCeremonyFactory = new OpeningCeremony__factory(owner);

  const openingCeremony: OpeningCeremony = await deployAndMine(
    'OPENING_CEREMONY', openingCeremonyFactory, openingCeremonyFactory.deploy,
    DEPLOYED.FRAX,
    DEPLOYED.TEMPLE,
    DEPLOYED.STAKING,
    DEPLOYED.LOCKED_OG_TEMPLE,
    DEPLOYED.TREASURY,
    treasuryManagementProxy.address,
    toAtto(5000),  // harverst threshold
    toAtto(30000), // invite threshold
    2, /* invites per person */
    { numerator: 178379, denominator: 1000000 },
    { numerator: 116487, denominator: 1000000 },
  );

  console.log();
  console.log('Add opening ceremony as one of the allowed minters of TEMPLE');
  await templeToken.addMinter(openingCeremony.address);

  console.log('Pause Presale (as we are done with it)');
  await presale.pause();

  console.log('Lower APY on public staking contract');
  await staking.setEpy(7000, 1000000);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });