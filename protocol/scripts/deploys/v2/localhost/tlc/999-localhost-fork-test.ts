import { Signer } from 'ethers';
import { expect } from "chai";
import { ethers } from 'hardhat';

import { impersonateSigner, mineBlocks } from '../../../../../test/helpers';
import { ensureExpectedEnvvars, mine } from '../../../helpers';
import { getDeployedContracts, connectToContracts } from '../../sepolia/contract-addresses';
import { ERC20__factory, TempleERC20Token__factory } from '../../../../../typechain';
import { PromiseOrValue } from '../../../../../typechain/common';

const TEMPLE_WHALE = "0xFa4FC4ec2F81A4897743C5b4f45907c02ce06199";
const DAI_WHALE = "0x60FaAe176336dAb62e284Fe19B885B095d29fB7F";

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
  const aliceInitialDaiBalance = ethers.utils.parseEther("20000");
  const borrowDaiAmount = ethers.utils.parseEther("1000");
  const maxLtvAliceBorrowDaiAmount = ethers.utils.parseEther("8712.5"); // 85% of collateral amount

  const templeWhale = await impersonateSigner(TEMPLE_WHALE);
  const daiWhale = await impersonateSigner(DAI_WHALE);

  const checkBalances = async(
    desc: string,
  ) => {
    console.log(`\n\n*** ${desc} ***`);
    console.log('temple balance of alice', await templeV2contracts.temple.balanceOf(await alice.getAddress()));
    console.log('temple balance of tlc', await templeV2contracts.temple.balanceOf(TEMPLE_V2_DEPLOYED.TEMPLE_LINE_OF_CREDIT.ADDRESS));
    console.log('dai balance of alice', await templeV2contracts.dai.balanceOf(await alice.getAddress()));
    console.log('dai balance of trv', await templeV2contracts.dai.balanceOf(templeV2contracts.trv.address));
    console.log('dusd balance of tlc', await templeV2contracts.dusd.balanceOf(TEMPLE_V2_DEPLOYED.STRATEGIES.TLC_STRATEGY.ADDRESS));
    console.log('dTemple totalSupply', await templeV2contracts.dtemple.totalSupply());
  }

  /* Seed Alice & TRV wallets */
  {
    const daiToken = ERC20__factory.connect(TEMPLE_V2_DEPLOYED.EXTERNAL.MAKER_DAO.DAI_TOKEN, daiWhale);
    const templeToken = TempleERC20Token__factory.connect(TEMPLE_V2_DEPLOYED.CORE.TEMPLE_TOKEN, templeWhale);

    // Seeding TRV with dai
    await mine(daiToken.transfer( 
      TEMPLE_V2_DEPLOYED.TREASURY_RESERVES_VAULT.ADDRESS,
      trvDaiPool
    ));

    // Seeding Alice with temple
    await mine(templeToken.transfer(await alice.getAddress(), collateralAmount));
    
    // Seeding alice with dai
    await mine(daiToken.transfer(await alice.getAddress(), aliceInitialDaiBalance));
    await checkBalances("Seeding finished");
  }

  /* Alice adds collateral & borrows dai */
  {    
    // add alice collateral amount to TLC
    await mine(aliceV2contracts.temple.approve(TEMPLE_V2_DEPLOYED.TEMPLE_LINE_OF_CREDIT.ADDRESS, collateralAmount));
    await mine(aliceV2contracts.tlc.addCollateral(collateralAmount, await alice.getAddress()));
    await checkBalances("Alice added temple collateral");
    await expect(await templeV2contracts.temple.balanceOf(await alice.getAddress())).to.eq(0);
    await expect(await templeV2contracts.dai.balanceOf(await alice.getAddress())).to.eq(aliceInitialDaiBalance);

    // borrow dai for alice
    await mine(aliceV2contracts.tlc.borrow(borrowDaiAmount, await alice.getAddress()));
    await checkBalances("Alice borrowed dai");
    await expect(await templeV2contracts.dai.balanceOf(await alice.getAddress()))
    .to.eq(aliceInitialDaiBalance.add(borrowDaiAmount));
  }

  /* Alice repays half debt */
  {
    await mine(aliceV2contracts.dai.approve(TEMPLE_V2_DEPLOYED.TEMPLE_LINE_OF_CREDIT.ADDRESS, borrowDaiAmount.div(2)));
    await mine (aliceV2contracts.tlc.repay(borrowDaiAmount.div(2), await alice.getAddress()));
    await checkBalances("Alice repayed ~half debt");
  }

  /* Alice repays total debt & removes collateral */
  {
    await mine(aliceV2contracts.dai.approve(TEMPLE_V2_DEPLOYED.TEMPLE_LINE_OF_CREDIT.ADDRESS, borrowDaiAmount));
    await mine (aliceV2contracts.tlc.repayAll(await alice.getAddress()));
    await checkBalances("Alice repayed all deb");

    await mine (aliceV2contracts.tlc.removeCollateral(collateralAmount, await alice.getAddress()));
    await checkBalances("Alice removed collateral");
  }

  /* Alice add collateral, borrows dai & gets liquidated */
  { 
    await mine(aliceV2contracts.temple.approve(TEMPLE_V2_DEPLOYED.TEMPLE_LINE_OF_CREDIT.ADDRESS, collateralAmount));
    await mine(aliceV2contracts.tlc.addCollateral(collateralAmount, await alice.getAddress()));
    await mine(aliceV2contracts.tlc.borrow(maxLtvAliceBorrowDaiAmount, await alice.getAddress()));
    await checkBalances("Alice borrowed");
    
    const accounts: PromiseOrValue<string>[] = [await alice.getAddress()];
    let status = await aliceV2contracts.tlc.computeLiquidity(accounts);
    await expect(status[0].hasExceededMaxLtv).to.false;

    await mineBlocks();
    status = await aliceV2contracts.tlc.computeLiquidity(accounts);
    await expect(status[0].hasExceededMaxLtv).to.true;
    await expect(status[0].currentDebt).to.eq(ethers.utils.parseEther('8712.500015150809241213'));
    await mine(aliceV2contracts.tlc.batchLiquidate(accounts));
    
    status = await aliceV2contracts.tlc.computeLiquidity(accounts);
    await expect(status[0].hasExceededMaxLtv).to.false;
    await expect(status[0].currentDebt).to.eq(0);

    // Alice shouldn't be able to repay her debt any longer
    await mine(aliceV2contracts.dai.approve(TEMPLE_V2_DEPLOYED.TEMPLE_LINE_OF_CREDIT.ADDRESS, ethers.utils.parseEther('8712.500015150809241213')));
    await expect(aliceV2contracts.tlc.repayAll(await alice.getAddress())
      ).to.be.revertedWithCustomError(aliceV2contracts.tlc, "ExpectedNonZero");
    await expect(await templeV2contracts.temple.balanceOf(await alice.getAddress())).to.eq(0);
    await expect(await templeV2contracts.dtemple.totalSupply()).to.eq(collateralAmount);
    
    await checkBalances("Final balances");
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
