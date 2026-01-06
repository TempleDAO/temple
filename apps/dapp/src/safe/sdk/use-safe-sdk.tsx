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
  encodeMultiSendData,
  standardizeMetaTransactionData,
  ZERO_ADDRESS,
} from './utils/utils';
import {
  V1Service,
  SafeMultisigConfirmation,
  SafeMultisigTransaction,
} from 'safe/open-api/client';
import { Nullable } from 'types/util';
import {
  SafeMultisigTransactionResponse,
  TransactionOptions,
  TransactionResult,
  MetaTransactionData,
  OperationType,
} from '@safe-global/safe-core-sdk-types';
import {
  adjustVInSignature,
  generatePreValidatedSignature,
} from './signatures/utils';
import {
  getSafeContract,
  getMultiSendContract,
} from './contracts/safeDeploymentContracts';
import { DEFAULT_SAFE_VERSION } from './contracts/config';
import EthSafeTransaction from './transactions/SafeTransaction';

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

  const proposeTransaction = async (
    transactions: MetaTransactionData[],
    targetSafeAddress?: string
  ): Promise<void> => {
    if (!signer) {
      throw new Error('signer undefined');
    }

    // Use provided address or fall back to context address
    const addressToUse = targetSafeAddress || safeAddress;

    // Validate address is not empty
    if (!addressToUse || addressToUse.trim() === '') {
      throw new Error('Safe address not provided');
    }

    const safeContract = (await getSafeContract({
      signer,
      safeVersion: DEFAULT_SAFE_VERSION,
      customSafeAddress: addressToUse,
    })) as SafeMasterCopy_V1_3_0;

    const signerAddress = await signer.getAddress();
    const nonce = (await safeContract.nonce()).toNumber();

    // Build transaction data
    let transactionData: {
      to: string;
      value: string;
      data: string;
      operation: OperationType;
    };

    if (transactions.length === 0) {
      throw new Error('No transactions provided');
    } else if (transactions.length === 1) {
      // Single transaction
      const tx = standardizeMetaTransactionData(transactions[0]);
      transactionData = {
        to: tx.to,
        value: tx.value || '0',
        data: tx.data || '0x',
        operation: tx.operation ?? OperationType.Call,
      };
    } else {
      // Multiple transactions - use MultiSend
      const multiSendContract = await getMultiSendContract({
        signer,
        safeVersion: DEFAULT_SAFE_VERSION,
      });

      const multiSendData = encodeMultiSendData(
        transactions.map(standardizeMetaTransactionData)
      );

      transactionData = {
        to: multiSendContract.address,
        value: '0',
        data: multiSendContract.interface.encodeFunctionData('multiSend', [
          multiSendData,
        ]),
        operation: OperationType.DelegateCall,
      };
    }

    // Create SafeTransaction for hashing
    const safeTransaction = new EthSafeTransaction({
      to: transactionData.to,
      value: transactionData.value,
      data: transactionData.data,
      operation: transactionData.operation,
      safeTxGas: '0',
      baseGas: '0',
      gasPrice: '0',
      gasToken: ZERO_ADDRESS,
      refundReceiver: ZERO_ADDRESS,
      nonce,
    });

    // Get transaction hash
    const txHash = await getTransactionHash(safeContract, safeTransaction);

    // Sign the transaction hash
    const messageArray = ethers.utils.arrayify(txHash);
    let signature = await signer.signMessage(messageArray);
    signature = adjustVInSignature(
      'eth_sign',
      signature,
      txHash,
      signerAddress
    );

    // Submit to Safe Transaction Service
    const safeMultisigTx: SafeMultisigTransaction = {
      safe: addressToUse,
      to: transactionData.to,
      // Type assertion required: OpenAPI spec incorrectly defines value as 'number',
      // but we must use string to preserve precision for large wei amounts.
      // Token amounts with 18 decimals produce 25-digit numbers that exceed
      // JavaScript's safe integer range (2^53-1 = 16 digits). The Safe Transaction
      // Service API accepts string values despite the spec (response types use string).
      // The HTTP client serializes this as a JSON string, which the API handles correctly.
      value: transactionData.value as unknown as number,
      data: transactionData.data,
      operation: transactionData.operation,
      gasToken: ZERO_ADDRESS,
      safeTxGas: 0,
      baseGas: 0,
      gasPrice: 0,
      refundReceiver: ZERO_ADDRESS,
      nonce,
      contractTransactionHash: txHash,
      sender: signerAddress,
      signature,
      origin: 'Spice Auction Admin',
    };

    await V1Service.v1SafesMultisigTransactionsCreate(
      addressToUse,
      safeMultisigTx
    );
  };

  return {
    signSafeTx,
    executeSafeTx,
    proposeTransaction,
  };
};
