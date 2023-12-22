// import { useEffect, useState } from 'react';
// import { ethers } from 'ethers';
import { Gnosis_safe as SafeMasterCopy_V1_3_0 } from 'types/typechain/safe/src/ethers-v5/v1.3.0/Gnosis_safe';
// import Safe, { EthersAdapter, SafeAccountConfig, SafeFactory } from '@safe-global/protocol-kit';
import { BigNumber, Signer, ethers } from 'ethers';
import {
  copyTransaction,
  getOwners,
  getOwnersWhoApprovedTx,
  getThreshold,
  getTransactionHash,
  isSafeMultisigTransactionResponse,
  toSafeTransactionType,
} from 'components/Pages/Safe/admin/utils';
import { V1Service, SafeMultisigConfirmation } from 'safeApi/client';
import { Nullable } from 'types/util';
import {
  SafeMultisigTransactionResponse,
  SafeTransaction,
  TransactionOptions,
  TransactionResult,
} from '@safe-global/safe-core-sdk-types';
import { adjustVInSignature, generatePreValidatedSignature } from 'components/Pages/Safe/admin/signatures';
import { getSafeContract } from 'components/Pages/Safe/admin/contracts/safeDeploymentContracts';
import { DEFAULT_SAFE_VERSION } from 'components/Pages/Safe/admin/contracts/config';
import { SafeMultisigTransactionsResponse } from '@safe-global/safe-gateway-typescript-sdk';
// import SafeApiKit, { SignatureResponse } from '@safe-global/api-kit';

export const signSafeTx = async (signer: Nullable<Signer>, safeTxHash: string) => {
  if (!signer) {
    console.error('signer undefined');
    return;
  }
  const signerAddress = await signer.getAddress();
  const messageArray = ethers.utils.arrayify(safeTxHash);

  let tmpSignature = await signer.signMessage(messageArray);
  tmpSignature = adjustVInSignature('eth_sign', tmpSignature, safeTxHash, signerAddress);
  const safeSignature: SafeMultisigConfirmation = {
    signature: tmpSignature,
  };
  V1Service.v1MultisigTransactionsConfirmationsCreate(safeTxHash, safeSignature);
};

/**
 * Executes a Safe transaction.
 *
 * @param safeTransaction - The Safe transaction to execute
 * @param options - The Safe transaction execution options. Optional
 * @returns The Safe transaction response
 * @throws "No signer provided"
 * @throws "There are X signatures missing"
 * @throws "Cannot specify gas and gasLimit together in transaction options"
 */
export const executeSafeTx = async (
  signer: Nullable<Signer>,
  safeAddress: string,
  safeTxHash: string,
  options?: TransactionOptions
): Promise<TransactionResult> => {
  if (!signer) {
    throw new Error('signer undefined');
  }
  // const safeInstance = await getSafeContract({signer, safeVersion: DEFAULT_SAFE_VERSION});
  // console.log('safeInstance', safeInstance);
  // return {hash: ''};
  const txTmp = await V1Service.v1MultisigTransactionsRead(safeTxHash);
  console.log('txTmp', txTmp);
  const safeTransaction: SafeMultisigTransactionResponse = {
    ...txTmp,
    data: txTmp.data ?? undefined,
    gasToken: txTmp.gasToken!,
    refundReceiver: txTmp.refundReceiver ?? undefined,
    fee: txTmp.fee?.toString(),
    origin: txTmp.origin!,
    signatures: txTmp.signatures ?? undefined
  }
  console.log('safeTransaction', safeTransaction);
  const safeContract = (await getSafeContract({
    signer,
    safeVersion: DEFAULT_SAFE_VERSION,
    customSafeAddress: safeAddress,
  })) as SafeMasterCopy_V1_3_0;
  console.log('safeContract', safeContract);

  const transaction = isSafeMultisigTransactionResponse(safeTransaction)
    ? await toSafeTransactionType(safeContract, signer, safeTransaction)
    : safeTransaction;
  
  console.log('transaction', transaction);

  // return {hash: ''};
  
  const signedSafeTransaction = await copyTransaction(safeContract, signer, transaction);

  console.log('signedSafeTransaction', signedSafeTransaction);

  const txHash = await getTransactionHash(safeContract, signedSafeTransaction);
  console.log('txHash', txHash);
  // const ownersWhoApprovedTx = await getOwnersWhoApprovedTx(safeContract, txHash);
  const ownersWhoApprovedTx :string[] = [];
  safeTransaction.confirmations?.map(conf => ownersWhoApprovedTx.push(conf.owner));
  console.log('ownersWhoApprovedTx', ownersWhoApprovedTx);
  for (const owner of ownersWhoApprovedTx) {
    signedSafeTransaction.addSignature(generatePreValidatedSignature(owner));
  }
  const owners = await getOwners(safeContract);
  console.log('owners', owners);
  const threshold = await getThreshold(safeContract);
  console.log('threshold', threshold);
  const signerAddress = await signer.getAddress();
  if (threshold > signedSafeTransaction.signatures.size && signerAddress && owners.includes(signerAddress)) {
    signedSafeTransaction.addSignature(generatePreValidatedSignature(signerAddress));
  }

  if (threshold > signedSafeTransaction.signatures.size) {
    const signaturesMissing = threshold - signedSafeTransaction.signatures.size;
    throw new Error(
      `There ${signaturesMissing > 1 ? 'are' : 'is'} ${signaturesMissing} signature${
        signaturesMissing > 1 ? 's' : ''
      } missing`
    );
  }

  const value = BigNumber.from(signedSafeTransaction.data.value);
  if (!value.isZero()) {
    const balance = await signer.getBalance();
    if (value.gt(BigNumber.from(balance))) {
      throw new Error('Not enough Ether funds');
    }
  }
  console.log('value', value);

  if (options?.gas && options?.gasLimit) {
    throw new Error('Cannot specify gas and gasLimit together in transaction options');
  }
  const sst = signedSafeTransaction.data;

  console.log('signedSafeTransaction.signatures', signedSafeTransaction.signatures);
  console.log('sst', sst);
  const txResponse = await safeContract.execTransaction(
    sst.to,
    sst.value,
    sst.data,
    sst.operation,
    sst.safeTxGas,
    sst.baseGas,
    sst.gasPrice,
    sst.gasToken,
    sst.refundReceiver,
    signedSafeTransaction.signatures as any,
    {
      from: signerAddress,
      ...options,
    }
  );
  console.log('txResponse', txResponse);
  return txResponse;
};









// import { useConnectWallet, useSetChain } from '@web3-onboard/react';
// import { TransactionResult } from '@safe-global/safe-core-sdk-types';
// import { Address } from '@web3-onboard/core/dist/types';

// export type useSafeSdkProps = {
//   signSafeTx: (safeTxHash: string) => Promise<SignatureResponse | undefined>;
//   executeSafeTx: (safeTxHash: string) => Promise<TransactionResult | undefined>;
//   createSafeGnosisWallet: (owners: Address[]) => Promise<void>;
// };

// export const useSafeSdk = (safeWallet: Address): useSafeSdkProps => {
//   const [{ wallet }] = useConnectWallet();
//   const [{ connectedChain }] = useSetChain();
//   const [safeSdk, setSafeSdk] = useState<Safe | undefined>(undefined);
//   const [safeService, setSafeService] = useState<SafeApiKit | undefined>(undefined);
//   const [safeFactory, setSafeFactory] = useState<SafeFactory | undefined>(undefined);

//   useEffect(() => {
//     async function initializeSafeSdk() {
//       if (!wallet) return;
//       const ethersProvider = new ethers.providers.Web3Provider(wallet.provider);
//       const ethAdapter = new EthersAdapter({
//         ethers,
//         signerOrProvider: ethersProvider.getSigner(),
//       });
//       setSafeFactory(await SafeFactory.create({ ethAdapter }));
//       const safe = await Safe.create({ ethAdapter, safeAddress: safeWallet });
//       if (connectedChain) {
//         setSafeService(new SafeApiKit({ chainId: BigInt(connectedChain.id) }));
//       }
//       setSafeSdk(safe);
//     }
//     initializeSafeSdk();
//   }, [wallet, safeWallet, connectedChain]);

//   const signSafeTx = async (safeTxHash: string) => {
//     if (!safeService || !safeSdk) {
//       console.error('safeService or safeSdk undefined');
//       return;
//     }
//     const safeTx = await safeService.getTransaction(safeTxHash);
//     if (!safeTx) {
//       console.error('undefined safeTx');
//       return;
//     }
//     const hash = safeTx.safeTxHash;
//     const signature = await safeSdk.signTransactionHash(hash);
//     return await safeService.confirmTransaction(hash, signature.data);
//   };

//   const createSafeGnosisWallet = async (owners: Address[]) => {
//     if (!safeFactory) {
//       console.error('safeFactory undefined');
//       return;
//     }
//     const safeAccountConfig: SafeAccountConfig = {
//       owners,
//       threshold: 1,
//     };
//     let gnosisDeployHash = '';
//     const safe: Safe = await safeFactory.deploySafe({
//       safeAccountConfig,
//       callback: (txHash) => {
//         gnosisDeployHash = txHash;
//       },
//     });
//     console.log('gnosisDeployHash', gnosisDeployHash); // 0x5CE28cAE5aAb002DcBc076d5A551A473a7C9dF89
//     console.log('safeGnosisWallet', safe);
//   };

//   const executeSafeTx = async (safeTxHash: string) => {
//     if (!safeService || !safeSdk) {
//       console.error('safeService or safeSdk undefined');
//       return;
//     }
//     const safeTx = await safeService.getTransaction(safeTxHash);
//     return await safeSdk.executeTransaction(safeTx);
//   };

//   return {
//     signSafeTx,
//     executeSafeTx,
//     createSafeGnosisWallet,
//   };
// };
