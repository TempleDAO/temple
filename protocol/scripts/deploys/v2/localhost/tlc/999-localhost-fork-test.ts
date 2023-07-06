import { BigNumber, Signer } from 'ethers';
import { ethers } from 'hardhat';
import { impersonateSigner } from '../../../../../test/helpers';
import { ensureExpectedEnvvars, mine } from '../../../helpers';
import { getDeployedContracts, connectToContracts } from '../../sepolia/contract-addresses';
import { FakeERC20, TempleDebtToken, TempleERC20Token } from '../../../../../typechain';


async function impersonateAndFund(owner: Signer, address: string, amount: number): Promise<Signer> {
  const signer = await impersonateSigner(address);
  console.log("impersonateAndFund:", address, amount);
  if (amount > 0) {
    await mine(owner.sendTransaction({
      to: await signer.getAddress(),
      value: ethers.utils.parseEther(amount.toString()),
    }));
  }
  return signer;
}

async function mintTemple(
  temple: TempleERC20Token,
  to: string,
  amount: BigNumber
){
  if (amount.gt(0)){
    await mine(temple.mint(to, amount))
  }
}

async function mintDai(
  dai: FakeERC20,
  to: string,
  amount: BigNumber
){
  if (amount.gt(0)){
    await mine(dai.mint(to, amount))
  }
}

async function checkBalances(
  desc: string,
  aliceAddress: string,
  trvAddress: string,
  tlcAddress: string,
  tlcStrategyAddress: string,
  temple: TempleERC20Token,
  dai: FakeERC20,
  dusd: TempleDebtToken,
  dtemple: TempleDebtToken,
){
  console.log(`\n\n*** ${desc} ***`);
  console.log('temple balance of alice', await temple.balanceOf(aliceAddress));
  console.log('temple balance of tlc', await temple.balanceOf(tlcAddress));
  console.log('dai balance of alice', await dai.balanceOf(aliceAddress));
  console.log('dai balance of trv', await dai.balanceOf(trvAddress));
  console.log('dusd balance of tlc', await dusd.balanceOf(tlcStrategyAddress));
  console.log('dTemple totalSupply', await dtemple.totalSupply());
}

async function main() {
  ensureExpectedEnvvars();
  const [owner, alice] = await ethers.getSigners();

  const TEMPLE_V2_DEPLOYED = getDeployedContracts();
  console.log("owner addr:", await owner.getAddress());
  console.log("temple v2 msig addr:", TEMPLE_V2_DEPLOYED.CORE.EXECUTOR_MSIG);
  console.log("alice addr:", await alice.getAddress());
  
  const templeV2CoreMsig = await impersonateAndFund(owner, TEMPLE_V2_DEPLOYED.CORE.EXECUTOR_MSIG, 10);

  const templeV2contracts = connectToContracts(templeV2CoreMsig);
  const aliceV2contracts = connectToContracts(alice);
  
  const trvDaiPool = ethers.utils.parseEther("100000");
  const collateralAmount = ethers.utils.parseEther("10000");
  const borrowDaiAmount = ethers.utils.parseEther("1000");

  /* Initial Mints */
  {
    // mint some dai for TRV
    await mintDai(templeV2contracts.dai, TEMPLE_V2_DEPLOYED.TREASURY_RESERVES_VAULT.ADDRESS, trvDaiPool);

    // mint some temple for Alice
    await mintTemple(templeV2contracts.temple, await alice.getAddress(), collateralAmount);

    // mint some dai for Alice
    await mintDai(templeV2contracts.dai, await alice.getAddress(), collateralAmount);
    await checkBalances(
      "Minting finished",
      await alice.getAddress(),
      TEMPLE_V2_DEPLOYED.TREASURY_RESERVES_VAULT.ADDRESS,
      TEMPLE_V2_DEPLOYED.TEMPLE_LINE_OF_CREDIT.ADDRESS,
      TEMPLE_V2_DEPLOYED.STRATEGIES.TLC_STRATEGY.ADDRESS,
      templeV2contracts.temple,
      templeV2contracts.dai,
      templeV2contracts.dusd,
      templeV2contracts.dtemple,
    );
  }

  /* Alice adds collateral & borrows dai */
  {    
    // add alice collateral amount to TLC
    await mine(aliceV2contracts.temple.approve(TEMPLE_V2_DEPLOYED.TEMPLE_LINE_OF_CREDIT.ADDRESS, collateralAmount));
    await mine(aliceV2contracts.tlc.addCollateral(collateralAmount, await alice.getAddress()));
    await checkBalances(
      "Alice added temple collateral",
      await alice.getAddress(),
      TEMPLE_V2_DEPLOYED.TREASURY_RESERVES_VAULT.ADDRESS,
      TEMPLE_V2_DEPLOYED.TEMPLE_LINE_OF_CREDIT.ADDRESS,
      TEMPLE_V2_DEPLOYED.STRATEGIES.TLC_STRATEGY.ADDRESS,
      templeV2contracts.temple,
      templeV2contracts.dai,
      templeV2contracts.dusd,
      templeV2contracts.dtemple,
    );

    // borrow dai for alice
    await mine(aliceV2contracts.tlc.borrow(borrowDaiAmount, await alice.getAddress()));
    await checkBalances(
      "Alice borrowed dai",
      await alice.getAddress(),
      TEMPLE_V2_DEPLOYED.TREASURY_RESERVES_VAULT.ADDRESS,
      TEMPLE_V2_DEPLOYED.TEMPLE_LINE_OF_CREDIT.ADDRESS,
      TEMPLE_V2_DEPLOYED.STRATEGIES.TLC_STRATEGY.ADDRESS,
      templeV2contracts.temple,
      templeV2contracts.dai,
      templeV2contracts.dusd,
      templeV2contracts.dtemple,
    );
  }

  /* Alice repays half debt */
  {
    await mine(aliceV2contracts.dai.approve(TEMPLE_V2_DEPLOYED.TEMPLE_LINE_OF_CREDIT.ADDRESS, borrowDaiAmount.div(2)));
    await mine (aliceV2contracts.tlc.repay(borrowDaiAmount.div(2), await alice.getAddress()));
    await checkBalances(
      "Alice repayed ~half debt",
      await alice.getAddress(),
      TEMPLE_V2_DEPLOYED.TREASURY_RESERVES_VAULT.ADDRESS,
      TEMPLE_V2_DEPLOYED.TEMPLE_LINE_OF_CREDIT.ADDRESS,
      TEMPLE_V2_DEPLOYED.STRATEGIES.TLC_STRATEGY.ADDRESS,
      templeV2contracts.temple,
      templeV2contracts.dai,
      templeV2contracts.dusd,
      templeV2contracts.dtemple,
    );
  }

  /* Alice repays total debt & removes collateral */
  {
    await mine(aliceV2contracts.dai.approve(TEMPLE_V2_DEPLOYED.TEMPLE_LINE_OF_CREDIT.ADDRESS, borrowDaiAmount));
    await mine (aliceV2contracts.tlc.repayAll(await alice.getAddress()));
    await checkBalances(
      "Alice repayed all deb",
      await alice.getAddress(),
      TEMPLE_V2_DEPLOYED.TREASURY_RESERVES_VAULT.ADDRESS,
      TEMPLE_V2_DEPLOYED.TEMPLE_LINE_OF_CREDIT.ADDRESS,
      TEMPLE_V2_DEPLOYED.STRATEGIES.TLC_STRATEGY.ADDRESS,
      templeV2contracts.temple,
      templeV2contracts.dai,
      templeV2contracts.dusd,
      templeV2contracts.dtemple,
    );

    await mine (aliceV2contracts.tlc.removeCollateral(collateralAmount, await alice.getAddress()));
    await checkBalances(
      "Alice removed collateral",
      await alice.getAddress(),
      TEMPLE_V2_DEPLOYED.TREASURY_RESERVES_VAULT.ADDRESS,
      TEMPLE_V2_DEPLOYED.TEMPLE_LINE_OF_CREDIT.ADDRESS,
      TEMPLE_V2_DEPLOYED.STRATEGIES.TLC_STRATEGY.ADDRESS,
      templeV2contracts.temple,
      templeV2contracts.dai,
      templeV2contracts.dusd,
      templeV2contracts.dtemple,
    );
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
