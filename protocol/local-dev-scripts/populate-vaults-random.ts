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

  function getRandomInt(min: number, max: number) : number{
	min = Math.ceil(min);
	max = Math.floor(max);
	return Math.floor(Math.random() * (max - min + 1)) + min; 
  }

  const TEMPLE_ADDR = '0x5FbDB2315678afecb367f032d93F642f64180aa3'
  const VAULT_ADDR = '0x1d3591a131f6C1951dae5a4dE3AfEF0Fc1d63e64'

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

    const accounts = (await ethers.getSigners()).slice(1,5);

    await templeToken.connect(account1).increaseAllowance(vault.address, toAtto(30000));
    await templeToken.connect(account2).increaseAllowance(vault.address, toAtto(30000));
    await templeToken.connect(account3).increaseAllowance(vault.address, toAtto(30000));
    await templeToken.connect(account4).increaseAllowance(vault.address, toAtto(30000));
    
    const numberOfHours = getRandomInt(1,24);
    const depositAmounts = new Map<string, number>();


    depositAmounts.set(account1.address, fromAtto(await templeToken.balanceOf(account1.address)));
    depositAmounts.set(account2.address, fromAtto(await templeToken.balanceOf(account2.address)));
    depositAmounts.set(account3.address, fromAtto(await templeToken.balanceOf(account3.address)));
    depositAmounts.set(account4.address, fromAtto(await templeToken.balanceOf(account4.address)));

    console.log(`Number of hours to input data: ${numberOfHours}`);

    for (let i = 0; i < numberOfHours; i++) {
        let numberOfTx = getRandomInt(3,6);
        for (let j=0; j < numberOfTx; j++) {
            let accountNum = getRandomInt(0,3);
            let amount = getRandomInt(1,1500);
            let depositedAmountForAddr = depositAmounts.get(accounts[accountNum].address) ?? 0
            if (depositedAmountForAddr - amount > 0) {
                await vault.connect(accounts[accountNum]).deposit(toAtto(amount));
                depositAmounts.set(accounts[accountNum].address, depositedAmountForAddr - amount)
            }
        }

        const shouldWithdraw = Math.random();
        if (shouldWithdraw <= 0.5) {
            numberOfTx = getRandomInt(1,3);
            let accountNum = getRandomInt(0,3);
            let amount = getRandomInt(1,100); 
            // check they've got enough, otherwise lets skip

            const bal = await vault.toTokenAmount(await vault.shareBalanceOf(accounts[accountNum].address))
            if (bal > toAtto(amount) && (fromAtto(bal) - amount) > 0) {
                let depositedAmountForAddr = depositAmounts.get(accounts[accountNum].address) ?? 0
                await vault.connect(accounts[accountNum]).withdraw(toAtto(amount));
                depositAmounts.set(accounts[accountNum].address, depositedAmountForAddr + amount)
            }
        }

        let blockTime = await blockTimestamp();
        await mineToTimestamp(blockTime + 60*60) // 1 hour
    }

    console.log(`Starting block timestamp: ${await blockTimestamp()}`);
    console.log(`Deposited Balance for account1: ${10000 - (depositAmounts.get(account1.address) ?? 0)}`)
    console.log(`Deposited Balance for account2: ${10000 - (depositAmounts.get(account2.address) ?? 0)}`)
    console.log(`Deposited Balance for account3: ${10000 - (depositAmounts.get(account3.address) ?? 0)}`)
    console.log(`Deposited Balance for account4: ${10000 - (depositAmounts.get(account4.address) ?? 0)}`)
  }

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
