import { Signer } from 'ethers';
import { expect } from "chai";
import { ethers } from 'hardhat';

import { impersonateSigner, mineForwardSeconds } from '../../../../test/helpers';
import { ensureExpectedEnvvars, mine } from '../../helpers';
import { getDeployedContracts, connectToContracts } from '../../mainnet/v2/contract-addresses';
import { ERC20__factory, TempleERC20Token__factory } from '../../../../typechain';
import { PromiseOrValue } from '../../../../typechain/common';

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
  console.log("owner addr:", await owner.getAddress());
  console.log("alice addr:", await alice.getAddress());

  const TEMPLE_V2_ADDRESSES = getDeployedContracts();
  console.log("temple v2 msig addr:", TEMPLE_V2_ADDRESSES.CORE.EXECUTOR_MSIG);
  
  const templeV2CoreMsig = await impersonateAndFund(owner, TEMPLE_V2_ADDRESSES.CORE.EXECUTOR_MSIG, 10);
  const TEMPLE_V2_INSTANCES = connectToContracts(templeV2CoreMsig);
  const ALICE_V2_INSTANCES = connectToContracts(alice);
  
  const collateralAmount = ethers.utils.parseEther("10000");
  const aliceInitialDaiBalance = ethers.utils.parseEther("20000");
  const borrowDaiAmount = ethers.utils.parseEther("1000");
  const maxLtvAliceBorrowDaiAmount = ethers.utils.parseEther("8712.5"); // 85% of collateral amount

  async function checkBalances (desc: string) {
    console.log(`\n\n*** ${desc} ***`);
    console.log('temple balance of alice', await TEMPLE_V2_INSTANCES.CORE.TEMPLE_TOKEN.balanceOf(await alice.getAddress()));
    console.log('temple balance of tlc', await TEMPLE_V2_INSTANCES.CORE.TEMPLE_TOKEN.balanceOf(TEMPLE_V2_ADDRESSES.TEMPLE_LINE_OF_CREDIT.ADDRESS));
    console.log('dai balance of alice', await TEMPLE_V2_INSTANCES.EXTERNAL.MAKER_DAO.DAI_TOKEN.balanceOf(await alice.getAddress()));
    console.log('dai balance of trv', await TEMPLE_V2_INSTANCES.EXTERNAL.MAKER_DAO.DAI_TOKEN.balanceOf(TEMPLE_V2_ADDRESSES.TREASURY_RESERVES_VAULT.ADDRESS));
    console.log('dusd balance of tlc', await TEMPLE_V2_INSTANCES.TREASURY_RESERVES_VAULT.D_USD_TOKEN.balanceOf(TEMPLE_V2_ADDRESSES.STRATEGIES.TLC_STRATEGY.ADDRESS));
    console.log('dTemple totalSupply', await TEMPLE_V2_INSTANCES.TREASURY_RESERVES_VAULT.D_TEMPLE_TOKEN.totalSupply());
  }

  /* Initial Setup */
  {
    const trvDaiPool = ethers.utils.parseEther("100000");
    const daiWhale = await impersonateSigner(DAI_WHALE);
    const templeWhale = await impersonateSigner(TEMPLE_WHALE);
    
    const daiToken = ERC20__factory.connect(TEMPLE_V2_ADDRESSES.EXTERNAL.MAKER_DAO.DAI_TOKEN, daiWhale);
    const templeToken = TempleERC20Token__factory.connect(TEMPLE_V2_ADDRESSES.CORE.TEMPLE_TOKEN, templeWhale);

    // Seeding TRV with dai
    await mine(daiToken.transfer( 
      TEMPLE_V2_ADDRESSES.TREASURY_RESERVES_VAULT.ADDRESS,
      trvDaiPool
    ));

    // Seeding Alice with temple
    await mine(templeToken.transfer(await alice.getAddress(), collateralAmount));
    
    // Seeding alice with dai
    await mine(daiToken.transfer(await alice.getAddress(), aliceInitialDaiBalance));
    await checkBalances("Seeding finished");

    // Temple base strategy & multisig can mint/burn $TEMPLE
    await mine(TEMPLE_V2_INSTANCES.CORE.TEMPLE_TOKEN.addMinter(TEMPLE_V2_ADDRESSES.STRATEGIES.TEMPLE_BASE_STRATEGY.ADDRESS));
  }

  /* Alice adds collateral & borrows dai */
  {    
    // add alice collateral amount to TLC
    await mine(ALICE_V2_INSTANCES.CORE.TEMPLE_TOKEN.approve(TEMPLE_V2_ADDRESSES.TEMPLE_LINE_OF_CREDIT.ADDRESS, collateralAmount));
    await mine(ALICE_V2_INSTANCES.TEMPLE_LINE_OF_CREDIT.INSTANCE.addCollateral(collateralAmount, await alice.getAddress()));
    await checkBalances("Alice added temple collateral");
    await expect(await TEMPLE_V2_INSTANCES.CORE.TEMPLE_TOKEN.balanceOf(await alice.getAddress())).to.eq(0);
    await expect(await TEMPLE_V2_INSTANCES.EXTERNAL.MAKER_DAO.DAI_TOKEN.balanceOf(await alice.getAddress())).to.eq(aliceInitialDaiBalance);

    // borrow dai for alice
    await mine(ALICE_V2_INSTANCES.TEMPLE_LINE_OF_CREDIT.INSTANCE.borrow(borrowDaiAmount, await alice.getAddress()));
    await checkBalances("Alice borrowed dai");
    await expect(await TEMPLE_V2_INSTANCES.EXTERNAL.MAKER_DAO.DAI_TOKEN.balanceOf(await alice.getAddress()))
    .to.eq(aliceInitialDaiBalance.add(borrowDaiAmount));
  }

  /* Alice repays half debt */
  {
    await mine(ALICE_V2_INSTANCES.EXTERNAL.MAKER_DAO.DAI_TOKEN.approve(TEMPLE_V2_ADDRESSES.TEMPLE_LINE_OF_CREDIT.ADDRESS, borrowDaiAmount.div(2)));
    await mine (ALICE_V2_INSTANCES.TEMPLE_LINE_OF_CREDIT.INSTANCE.repay(borrowDaiAmount.div(2), await alice.getAddress()));
    await checkBalances("Alice repayed ~half debt");
  }

  /* Alice repays total debt & removes collateral */
  {
    await mine(ALICE_V2_INSTANCES.EXTERNAL.MAKER_DAO.DAI_TOKEN.approve(TEMPLE_V2_ADDRESSES.TEMPLE_LINE_OF_CREDIT.ADDRESS, borrowDaiAmount));
    await mine (ALICE_V2_INSTANCES.TEMPLE_LINE_OF_CREDIT.INSTANCE.repayAll(await alice.getAddress()));
    await checkBalances("Alice repayed all deb");

    await mine (ALICE_V2_INSTANCES.TEMPLE_LINE_OF_CREDIT.INSTANCE.removeCollateral(collateralAmount, await alice.getAddress()));
    await checkBalances("Alice removed collateral");
  }

  /* Alice add collateral, borrows dai & gets liquidated */
  { 
    await mine(ALICE_V2_INSTANCES.CORE.TEMPLE_TOKEN.approve(TEMPLE_V2_ADDRESSES.TEMPLE_LINE_OF_CREDIT.ADDRESS, collateralAmount));
    await mine(ALICE_V2_INSTANCES.TEMPLE_LINE_OF_CREDIT.INSTANCE.addCollateral(collateralAmount, await alice.getAddress()));
    await mine(ALICE_V2_INSTANCES.TEMPLE_LINE_OF_CREDIT.INSTANCE.borrow(maxLtvAliceBorrowDaiAmount, await alice.getAddress()));
    await checkBalances("Alice borrowed");
    
    const accounts: PromiseOrValue<string>[] = [await alice.getAddress()];
    let status = await ALICE_V2_INSTANCES.TEMPLE_LINE_OF_CREDIT.INSTANCE.computeLiquidity(accounts);
    await expect(status[0].hasExceededMaxLtv).to.false;

    await mineForwardSeconds(1);
    status = await ALICE_V2_INSTANCES.TEMPLE_LINE_OF_CREDIT.INSTANCE.computeLiquidity(accounts);
    await expect(status[0].hasExceededMaxLtv).to.true;
    await expect(status[0].currentDebt).to.eq(ethers.utils.parseEther('8712.500015150809241213'));
    await mine(ALICE_V2_INSTANCES.TEMPLE_LINE_OF_CREDIT.INSTANCE.batchLiquidate(accounts));
    
    status = await ALICE_V2_INSTANCES.TEMPLE_LINE_OF_CREDIT.INSTANCE.computeLiquidity(accounts);
    await expect(status[0].hasExceededMaxLtv).to.false;
    await expect(status[0].currentDebt).to.eq(0);

    // Alice shouldn't be able to repay her debt any longer
    await mine(ALICE_V2_INSTANCES.EXTERNAL.MAKER_DAO.DAI_TOKEN.approve(TEMPLE_V2_ADDRESSES.TEMPLE_LINE_OF_CREDIT.ADDRESS, ethers.utils.parseEther('8712.500015150809241213')));
    await expect(ALICE_V2_INSTANCES.TEMPLE_LINE_OF_CREDIT.INSTANCE.repayAll(await alice.getAddress())
      ).to.be.revertedWithCustomError(ALICE_V2_INSTANCES.TEMPLE_LINE_OF_CREDIT.INSTANCE, "ExpectedNonZero");
    await expect(await TEMPLE_V2_INSTANCES.CORE.TEMPLE_TOKEN.balanceOf(await alice.getAddress())).to.eq(0);
    await expect(await TEMPLE_V2_INSTANCES.TREASURY_RESERVES_VAULT.D_TEMPLE_TOKEN.totalSupply()).to.eq(collateralAmount);
    
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
