import { Signer } from 'ethers';
import { ethers } from 'hardhat';
import { impersonateSigner } from '../../../../../test/helpers';
import { ensureExpectedEnvvars, mine } from '../../../helpers';
import { getDeployedContracts } from '../../sepolia/contract-addresses';


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
    const [owner] = await ethers.getSigners();

    const TEMPLE_V2_DEPLOYED = getDeployedContracts();
    console.log("owner addr:", await owner.getAddress());
    console.log("temple v2 msig:", TEMPLE_V2_DEPLOYED.CORE.EXECUTOR_MSIG);
    
    const templeV2Msig = await impersonateAndFund(owner, TEMPLE_V2_DEPLOYED.CORE.EXECUTOR_MSIG, 10);

}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
