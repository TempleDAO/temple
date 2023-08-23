import '@nomiclabs/hardhat-ethers';
import { ethers, network } from 'hardhat';
import { FakeERC20__factory, IERC20 } from '../../../../../typechain';
import {
    ZERO_ADDRESS,
    ensureExpectedEnvvars,
    mine,
} from '../../../helpers';
import { JsonRpcProvider } from "@ethersproject/providers"
import { BalancerSDK, PoolType, WeightedCreatePoolParameters } from '@balancer-labs/sdk';
import { BigNumber, Signer } from 'ethers';
import { HttpNetworkConfig } from 'hardhat/types';
import { getDeployedContracts } from '../contract-addresses';

async function createAndInitJoinWeightedPool(
    balancer: BalancerSDK,
    signer: Signer,
    name: string,
    symbol: string,
    tokenA: IERC20,
    amountA: BigNumber,
    weightA: number,
    tokenB: IERC20,
    amountB: BigNumber,
    weightB: number,
    fee: number, // pct
) {
    const ownerAddress = await signer.getAddress();
    await mine(tokenA.approve(balancer.contracts.vault.address, amountA));
    await mine(tokenB.approve(balancer.contracts.vault.address, amountB));
  
    const weightedPoolFactory = balancer.pools.poolFactory.of(PoolType.Weighted);
    const poolParameters: WeightedCreatePoolParameters = {
      name: name,
      symbol: symbol,
      tokenAddresses: [tokenA.address, tokenB.address],
      normalizedWeights: [
        ethers.utils.parseEther(weightA.toString()).toString(),
        ethers.utils.parseEther(weightB.toString()).toString(),
      ],
      rateProviders: [ZERO_ADDRESS, ZERO_ADDRESS],
      swapFeeEvm: ethers.utils.parseEther((fee/100).toString()).toString(),
      owner: ownerAddress,
    };
  
    // Build and send the create transaction
    const { to, data } = weightedPoolFactory.create(poolParameters);
    const receipt = await (
      await signer.sendTransaction({
        from: ownerAddress,
        to,
        data,
      })
    ).wait();
  
    // Check logs of creation receipt to get new pool ID and address
    const { poolAddress, poolId } =
      await weightedPoolFactory.getPoolAddressAndIdWithReceipt(
        (signer.provider as JsonRpcProvider),
        receipt
      );
  
    // Build initial join of pool
    const initJoinParams = weightedPoolFactory.buildInitJoin({
      joiner: ownerAddress,
      poolId,
      poolAddress,
      tokensIn: [tokenA.address, tokenB.address],
      amountsIn: [amountA.toString(), amountB.toString()],
    });
    
    // Sending initial join transaction
    await mine(signer.sendTransaction({
      to: initJoinParams.to,
      data: initJoinParams.data,
    }));
  
    // Check that pool balances are as expected after join
    const tokens = await balancer.contracts.vault.getPoolTokens(poolId);
    console.log('Pool Tokens Addresses: ' + tokens.tokens);
    console.log('Pool Tokens balances: ' + tokens.balances);
  }

async function main() {
  ensureExpectedEnvvars();
  const [owner] = await ethers.getSigners();
  console.log(await owner.getAddress());

  const TEMPLE_V2_ADDRESSES = getDeployedContracts();

  const chainId = await owner.getChainId();
  const rpcUrl = (network.config as HttpNetworkConfig).url;
  const balancer = new BalancerSDK({
    network: chainId,
    rpcUrl: rpcUrl,
  });

  const templeAmount = ethers.utils.parseEther("10000000");
  const templeToken = FakeERC20__factory.connect(TEMPLE_V2_ADDRESSES.CORE.TEMPLE_TOKEN, owner);
  await mine(templeToken.mint(await owner.getAddress(), templeAmount));

  const daiAmount = ethers.utils.parseEther("10250000");
  const daiToken = FakeERC20__factory.connect(TEMPLE_V2_ADDRESSES.EXTERNAL.MAKER_DAO.DAI_TOKEN, owner);
  await mine(daiToken.mint(await owner.getAddress(), daiAmount));

  await createAndInitJoinWeightedPool(
    balancer,
    owner,
    'Balancer 50TEMPLE-50DAI',
    '50TEMPLE-50DAI',
    templeToken,
    templeAmount,
    0.5,
    daiToken,
    daiAmount,
    0.5,
    0.5
  );
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });