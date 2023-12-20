import { useEffect, useState } from 'react';
import { ethers } from 'ethers';

import Safe, { EthersAdapter, SafeAccountConfig, SafeFactory } from '@safe-global/protocol-kit';
import SafeApiKit, { SignatureResponse } from '@safe-global/api-kit';

import { useConnectWallet, useSetChain } from '@web3-onboard/react';
import { TransactionResult } from '@safe-global/safe-core-sdk-types';
import { Address } from '@web3-onboard/core/dist/types';

export type useSafeSdkProps = {
  signSafeTx: (safeTxHash: string) => Promise<SignatureResponse | undefined>;
  executeSafeTx: (safeTxHash: string) => Promise<TransactionResult | undefined>;
  createSafeGnosisWallet: (owners: Address[]) => Promise<void>;
};

export const useSafeSdk = (safeWallet: Address): useSafeSdkProps => {
  const [{ wallet }] = useConnectWallet();
  const [{ connectedChain }] = useSetChain();
  const [safeSdk, setSafeSdk] = useState<Safe | undefined>(undefined);
  const [safeService, setSafeService] = useState<SafeApiKit | undefined>(undefined);
  const [safeFactory, setSafeFactory] = useState<SafeFactory | undefined>(undefined);

  useEffect(() => {
    async function initializeSafeSdk() {
      if (!wallet) return;
      const ethersProvider = new ethers.providers.Web3Provider(wallet.provider);
      const ethAdapter = new EthersAdapter({
        ethers,
        signerOrProvider: ethersProvider.getSigner(),
      });
      setSafeFactory(await SafeFactory.create({ ethAdapter }));
      const safe = await Safe.create({ ethAdapter, safeAddress: safeWallet });
      if (connectedChain) {
        setSafeService(new SafeApiKit({ chainId: BigInt(connectedChain.id) }));
      }
      setSafeSdk(safe);
    }
    initializeSafeSdk();
  }, [wallet, safeWallet, connectedChain]);

  const signSafeTx = async (safeTxHash: string) => {
    if (!safeService || !safeSdk) {
      console.error('safeService or safeSdk undefined');
      return;
    }
    const safeTx = await safeService.getTransaction(safeTxHash);
    if (!safeTx) {
      console.error('undefined safeTx');
      return;
    }
    const hash = safeTx.safeTxHash;
    const signature = await safeSdk.signTransactionHash(hash);
    return await safeService.confirmTransaction(hash, signature.data);
  };

  const createSafeGnosisWallet = async (owners: Address[]) => {
    if (!safeFactory) {
      console.error('safeFactory undefined');
      return;
    }
    const safeAccountConfig: SafeAccountConfig = {
      owners,
      threshold: 1,
    };
    let gnosisDeployHash = '';
    const safe: Safe = await safeFactory.deploySafe({
      safeAccountConfig,
      callback: (txHash) => {
        gnosisDeployHash = txHash;
      },
    });
    console.log('gnosisDeployHash', gnosisDeployHash); // 0x5CE28cAE5aAb002DcBc076d5A551A473a7C9dF89
    console.log('safeGnosisWallet', safe);
  };

  const executeSafeTx = async (safeTxHash: string) => {
    if (!safeService || !safeSdk) {
      console.error('safeService or safeSdk undefined');
      return;
    }
    const safeTx = await safeService.getTransaction(safeTxHash);
    return await safeSdk.executeTransaction(safeTx);
  };

  return {
    signSafeTx,
    executeSafeTx,
    createSafeGnosisWallet,
  };
};
