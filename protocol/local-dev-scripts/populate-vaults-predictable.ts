import '@nomiclabs/hardhat-ethers';
import { BigNumber } from 'ethers';
import { ethers } from 'hardhat';
import { blockTimestamp, mineToTimestamp } from '../test/helpers';
import {
  TempleERC20Token__factory,
  Vault__factory,
} from '../typechain';

function toAtto(n: number) {
    return BigNumber.from(10).pow(18).mul(n);
  }

  function fromAtto(n: BigNumber) {
    return n.div(BigNumber.from(10).pow(18)).toNumber();
  }

  const TEMPLE_ADDR = '0x5FbDB2315678afecb367f032d93F642f64180aa3';
  const VAULT_ADDR = '0x094Cdf3273265A664014e58ad40e295dA6330A09';

  const ONE_HOUR = 60*60;

  async function main() {
    const [owner, account1, account2, account3, account4] = await ethers.getSigners();

    // get temple addr
    const templeToken = await new TempleERC20Token__factory(owner).attach(
      TEMPLE_ADDR
    );

    const vault = await new Vault__factory(owner).attach(
      VAULT_ADDR
    );

    await templeToken.connect(account1).increaseAllowance(vault.address, toAtto(30000));
    await templeToken.connect(account2).increaseAllowance(vault.address, toAtto(30000));
    await templeToken.connect(account3).increaseAllowance(vault.address, toAtto(30000));
    await templeToken.connect(account4).increaseAllowance(vault.address, toAtto(30000));

    await vault.connect(account1).deposit(toAtto(100));
    await vault.connect(account2).deposit(toAtto(300));

    let blockTime = await blockTimestamp();
    await mineToTimestamp(blockTime + 60*60) // 1 hour
    await vault.connect(account2).withdraw(toAtto(150));

    blockTime = await blockTimestamp();
    await mineToTimestamp(blockTime + ONE_HOUR);

    await vault.connect(account1).deposit(toAtto(1000));
    await vault.connect(account3).deposit(toAtto(2500));
    await vault.connect(account4).deposit(toAtto(5500));

    blockTime = await blockTimestamp();
    await mineToTimestamp(blockTime + ONE_HOUR);
    await vault.connect(account2).deposit(toAtto(2700));

    blockTime = await blockTimestamp();
    await mineToTimestamp(blockTime + (ONE_HOUR * 7))
    await vault.connect(account1).withdraw(toAtto(100));
  }

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
