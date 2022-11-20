import { useEffect, useState } from 'react';
import { BigNumber, ethers } from 'ethers';

import environmentConfig from 'constants/env';
import { useWallet } from 'providers/WalletProvider';

import { RAMOSGoerli__factory } from 'types/typechain';
import { IBalancerHelpers__factory } from 'types/typechain/factories/IBalancerHelpers__factory';
import { AMO__IBalancerVault__factory } from 'types/typechain/factories/AMO__IBalancerVault__factory';

import type { IBalancerHelpers } from 'types/typechain/IBalancerHelpers';
import type { AMO__IBalancerVault } from 'types/typechain/AMO__IBalancerVault';

import { formatJoinRequestTuple } from './helpers';

export function useRamosAdmin() {
  const { ramos: RAMOS_ADDRESS, balancerHelpers: BALANCER_HELPERS_ADDRESS } = environmentConfig.contracts;

  //internal state
  const { signer } = useWallet();
  const [walletAddress, setWalletAddress] = useState<string>();
  const [tokens, setTokens] = useState<string[]>();
  const [balancerHelpers, setBalancerHelpers] = useState<IBalancerHelpers>();
  const [poolId, setPoolId] = useState<string>();

  const isConnected = tokens && walletAddress && signer && poolId && balancerHelpers;

  // outputs
  const [joinPoolInfo, setJoinPoolInfo] = useState<{ joinPoolRequest: string; minBptOut: string }>();

  useEffect(() => {
    async function setContracts() {
      if (signer) {
        const WALLET_ADDRESS = await signer.getAddress();

        const RAMOS_CONTRACT = new RAMOSGoerli__factory(signer).attach(RAMOS_ADDRESS);
        const POOL_ID = await RAMOS_CONTRACT.balancerPoolId();
        const BALANCER_VAULT_ADDRESS = await RAMOS_CONTRACT.balancerVault();
        const BALANCER_VAULT_CONTRACT = AMO__IBalancerVault__factory.connect(BALANCER_VAULT_ADDRESS, signer);
        const BALANCER_HELPERS_CONTRACT = IBalancerHelpers__factory.connect(BALANCER_HELPERS_ADDRESS, signer);
        const [tokens, ,] = await BALANCER_VAULT_CONTRACT.getPoolTokens(POOL_ID);
        setWalletAddress(WALLET_ADDRESS);
        setPoolId(POOL_ID);
        setBalancerHelpers(BALANCER_HELPERS_CONTRACT);
        setTokens(tokens);
      }
    }
    setContracts();
  }, [signer]);

  const createJoinPoolRequest = async (amounts: BigNumber[]) => {
    if (isConnected) {
      const queryUserData = ethers.utils.defaultAbiCoder.encode(['uint256', 'uint256[]', 'uint256'], [1, amounts, 0]);
      const queryJoinRequest: AMO__IBalancerVault.JoinPoolRequestStruct = {
        assets: tokens,
        maxAmountsIn: amounts,
        userData: queryUserData,
        fromInternalBalance: false,
      };

      const { amountsIn, bptOut } = await balancerHelpers.queryJoin(
        poolId,
        walletAddress,
        walletAddress,
        queryJoinRequest
      );

      const userData = ethers.utils.defaultAbiCoder.encode(['uint256', 'uint256[]', 'uint256'], [1, amountsIn, bptOut]);
      const finalRequest: AMO__IBalancerVault.JoinPoolRequestStruct = {
        assets: tokens,
        maxAmountsIn: amountsIn,
        userData: userData,
        fromInternalBalance: false,
      };

      setJoinPoolInfo({
        joinPoolRequest: formatJoinRequestTuple(finalRequest),
        minBptOut: bptOut.toString(),
      });
    }
  };

  return {
    createJoinPoolRequest,
    joinPoolInfo,
  };
}
