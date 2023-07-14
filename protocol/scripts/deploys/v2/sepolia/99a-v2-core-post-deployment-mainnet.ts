import { ethers } from 'hardhat';
import { 
  ensureExpectedEnvvars,
  impersonateSigner,
  mine
} from '../../helpers';
import { 
  connectToContracts,
  getDeployedContracts
} from './contract-addresses';
import { ITempleStrategy, TempleERC20Token__factory } from '../../../../typechain';
import { Signer } from 'ethers';


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
  const templeV2contracts = connectToContracts(owner);
  const templeMultisig = await impersonateAndFund(owner, TEMPLE_V2_DEPLOYED.CORE.EXECUTOR_MSIG, 10);
  const templeToken = TempleERC20Token__factory.connect(TEMPLE_V2_DEPLOYED.CORE.TEMPLE_TOKEN, templeMultisig);

  // Setup Temple => dTemple & base strategy
  {
    // TRV can mint/burn $dTEMPLE
    await mine(templeV2contracts.dtemple.addMinter(TEMPLE_V2_DEPLOYED.TREASURY_RESERVES_VAULT.ADDRESS));

    // Temple base strategy & multisig can mint/burn $TEMPLE
    await mine(templeToken.addMinter(TEMPLE_V2_DEPLOYED.STRATEGIES.TEMPLE_BASE_STRATEGY.ADDRESS));

    const debtCeiling: ITempleStrategy.AssetBalanceStruct[] = [{
        asset: TEMPLE_V2_DEPLOYED.CORE.TEMPLE_TOKEN,
        balance: ethers.utils.parseEther("100000"),
    }];

    await mine(templeV2contracts.trv.addStrategy(
        TEMPLE_V2_DEPLOYED.STRATEGIES.TEMPLE_BASE_STRATEGY.ADDRESS,
        0, // underperformingEquityThreeshold
        debtCeiling
      ));

    // temple -> dTemple
    await mine(templeV2contracts.trv.setBorrowToken(
        TEMPLE_V2_DEPLOYED.CORE.TEMPLE_TOKEN,
        TEMPLE_V2_DEPLOYED.STRATEGIES.TEMPLE_BASE_STRATEGY.ADDRESS,
        0,
        0,
        TEMPLE_V2_DEPLOYED.TREASURY_RESERVES_VAULT.D_TEMPLE_TOKEN
      ));
  }

  // Setup DAI => dUSD & DSR strategy
  {
    // TRV can mint/burn dUsd
    await mine(templeV2contracts.dusd.addMinter(TEMPLE_V2_DEPLOYED.TREASURY_RESERVES_VAULT.ADDRESS));

    const debtCeiling: ITempleStrategy.AssetBalanceStruct[] = [{
        asset: TEMPLE_V2_DEPLOYED.EXTERNAL.MAKER_DAO.DAI_TOKEN,
        balance: ethers.utils.parseEther("100000"),
      }];

    await mine(templeV2contracts.trv.addStrategy(
        TEMPLE_V2_DEPLOYED.STRATEGIES.DSR_BASE_STRATEGY.ADDRESS,
        0, // underperformingEquityThreeshold
        debtCeiling
      ));

    // dai -> dUsd
    await mine(templeV2contracts.trv.setBorrowToken(
        TEMPLE_V2_DEPLOYED.EXTERNAL.MAKER_DAO.DAI_TOKEN,
        TEMPLE_V2_DEPLOYED.STRATEGIES.DSR_BASE_STRATEGY.ADDRESS,
        ethers.utils.parseEther("10000"),
        ethers.utils.parseEther("10000"),
        TEMPLE_V2_DEPLOYED.TREASURY_RESERVES_VAULT.D_USD_TOKEN
      ));
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