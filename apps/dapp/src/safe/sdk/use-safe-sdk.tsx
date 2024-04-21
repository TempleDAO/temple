import { Gnosis_safe as SafeMasterCopy_V1_3_0 } from 'types/typechain/@safe-global/safe-deployments/v1.3.0/Gnosis_safe';
import { BigNumber, Signer, ethers } from 'ethers';
import {
  copyTransaction,
  getEncodedTransaction,
  getOwners,
  getOwnersWhoApprovedTx,
  getThreshold,
  getTransactionHash,
  isSafeMultisigTransactionResponse,
  toSafeTransactionType,
} from './utils/utils';
import { V1Service, SafeMultisigConfirmation } from 'safe/open-api/client';
import { Nullable } from 'types/util';
import {
  SafeMultisigTransactionResponse,
  TransactionOptions,
  TransactionResult,
} from '@safe-global/safe-core-sdk-types';
import {
  adjustVInSignature,
  generatePreValidatedSignature,
} from './signatures/utils';
import { getSafeContract } from './contracts/safeDeploymentContracts';
import { DEFAULT_SAFE_VERSION } from './contracts/config';

export const useSafeSdk = (signer: Nullable<Signer>, safeAddress: string) => {
  const signSafeTx = async (safeTxHash: string) => {
    if (!signer) {
      console.error('signer undefined');
      return;
    }
    const signerAddress = await signer.getAddress();
    const messageArray = ethers.utils.arrayify(safeTxHash);

    let tmpSignature = await signer.signMessage(messageArray);
    tmpSignature = adjustVInSignature(
      'eth_sign',
      tmpSignature,
      safeTxHash,
      signerAddress
    );
    const safeSignature: SafeMultisigConfirmation = {
      signature: tmpSignature,
    };
    await V1Service.v1MultisigTransactionsConfirmationsCreate(
      safeTxHash,
      safeSignature
    );
  };

  const executeSafeTx = async (
    safeTxHash: string,
    options?: TransactionOptions
  ): Promise<TransactionResult> => {
    if (!signer) {
      throw new Error('signer undefined');
    }
    const txTmp = await V1Service.v1MultisigTransactionsRead(safeTxHash);
    const safeTransaction: SafeMultisigTransactionResponse = {
      ...txTmp,
      data: txTmp.data ?? undefined,
      gasToken: txTmp.gasToken!,
      refundReceiver: txTmp.refundReceiver ?? undefined,
      fee: txTmp.fee?.toString(),
      origin: txTmp.origin!,
      signatures: txTmp.signatures ?? undefined,
    };
    const safeContract = (await getSafeContract({
      signer,
      safeVersion: DEFAULT_SAFE_VERSION,
      customSafeAddress: safeAddress,
    })) as SafeMasterCopy_V1_3_0;

    const transaction = isSafeMultisigTransactionResponse(safeTransaction)
      ? await toSafeTransactionType(safeContract, signer, safeTransaction)
      : safeTransaction;

    const signedSafeTransaction = await copyTransaction(
      safeContract,
      signer,
      transaction
    );
    const txHash = await getTransactionHash(
      safeContract,
      signedSafeTransaction
    );
    const ownersWhoApprovedTx = await getOwnersWhoApprovedTx(
      safeContract,
      txHash
    );
    for (const owner of ownersWhoApprovedTx) {
      signedSafeTransaction.addSignature(generatePreValidatedSignature(owner));
    }
    const owners = await getOwners(safeContract);
    const threshold = await getThreshold(safeContract);
    const signerAddress = await signer.getAddress();
    if (
      threshold > signedSafeTransaction.signatures.size &&
      signerAddress &&
      owners.includes(signerAddress)
    ) {
      signedSafeTransaction.addSignature(
        generatePreValidatedSignature(signerAddress)
      );
    }

    if (threshold > signedSafeTransaction.signatures.size) {
      const signaturesMissing =
        threshold - signedSafeTransaction.signatures.size;
      throw new Error(
        `There ${
          signaturesMissing > 1 ? 'are' : 'is'
        } ${signaturesMissing} signature${
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

    if (options?.gas && options?.gasLimit) {
      throw new Error(
        'Cannot specify gas and gasLimit together in transaction options'
      );
    }
    const sst = signedSafeTransaction.data;
    try {
      // Use this encoded data to test on tenderly for a simulated tx e.g. https://dashboard.tenderly.co/public/safe/safe-apps/simulator/8aa753dc-43fa-4cf6-b37b-f0da7b499f18
      const encodedTx = await getEncodedTransaction(
        safeContract,
        signedSafeTransaction
      );
      console.debug('encodedTx', encodedTx);
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
        signedSafeTransaction.encodedSignatures(),
        {
          from: signerAddress,
          ...options,
        }
      );
      return txResponse;
    } catch (e) {
      throw e;
    }
  };

  return {
    signSafeTx,
    executeSafeTx,
  };
};
