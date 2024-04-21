import { Signer } from '@ethersproject/abstract-signer';
import {
  MetaTransactionData,
  OperationType,
  SafeMultisigTransactionResponse,
  SafeTransaction,
  SafeTransactionData,
  SafeTransactionDataPartial,
  SafeVersion,
} from '@safe-global/safe-core-sdk-types';
import { SAFE_FEATURES, hasSafeFeature } from './safeVersions';
import { arrayify } from '@ethersproject/bytes';
import { pack as solidityPack } from '@ethersproject/solidity';
import EthSafeTransaction from '../transactions/SafeTransaction';
import {
  CreateTransactionProps,
  StandardizeSafeTransactionDataProps,
} from './types';
import { estimateGas } from '../transactions/gas';
import { DEFAULT_SAFE_VERSION } from '../contracts/config';
import { EthSafeSignature } from '../signatures/SafeSignature';
import { Gnosis_safe as Safe_V1_3_0 } from 'types/typechain/@safe-global/safe-deployments/v1.3.0/Gnosis_safe';
import {
  getMultiSendCallOnlyContract,
  getMultiSendCallOnlyContractDeploymentDetails,
  getMultiSendContract,
  getMultiSendContractDeploymentDetails,
  getSafeContract,
} from '../contracts/safeDeploymentContracts';

export const ZERO_ADDRESS = `0x${'0'.repeat(40)}`;

export function isSafeMultisigTransactionResponse(
  safeTransaction: SafeTransaction | SafeMultisigTransactionResponse
): safeTransaction is SafeMultisigTransactionResponse {
  return (
    (safeTransaction as SafeMultisigTransactionResponse).isExecuted !==
    undefined
  );
}

/**
 * Converts a transaction from type SafeMultisigTransactionResponse to type SafeTransaction
 *
 * @param serviceTransactionResponse - The transaction to convert
 * @returns The converted transaction with type SafeTransaction
 */
export const toSafeTransactionType = async (
  safeContract: Safe_V1_3_0,
  signer: Signer,
  serviceTransactionResponse: SafeMultisigTransactionResponse
): Promise<SafeTransaction> => {
  const safeTransactionData: SafeTransactionDataPartial = {
    to: serviceTransactionResponse.to,
    value: serviceTransactionResponse.value,
    data: serviceTransactionResponse.data || '0x',
    operation: serviceTransactionResponse.operation,
    safeTxGas: serviceTransactionResponse.safeTxGas.toString(),
    baseGas: serviceTransactionResponse.baseGas.toString(),
    gasPrice: serviceTransactionResponse.gasPrice,
    gasToken: serviceTransactionResponse.gasToken,
    refundReceiver: serviceTransactionResponse.refundReceiver,
    nonce: serviceTransactionResponse.nonce,
  };
  const safeVersion = (await safeContract.VERSION()) as SafeVersion;
  const multiSendDeploymentDetails =
    await getMultiSendContractDeploymentDetails(
      safeVersion,
      await signer.getChainId()
    );
  const multiSendCallOnlyDeploymentDetails =
    await getMultiSendCallOnlyContractDeploymentDetails(
      safeVersion,
      await signer.getChainId()
    );
  const safeTransaction = await createTransaction({
    safeContract,
    signer,
    multiSendContractAddress: multiSendDeploymentDetails.defaultAddress,
    multiSendCallOnlyContractAddress:
      multiSendCallOnlyDeploymentDetails.defaultAddress,
    safeTransactionData,
  });
  serviceTransactionResponse.confirmations?.map((confirmation) => {
    const signature = new EthSafeSignature(
      confirmation.owner,
      confirmation.signature
    );
    safeTransaction.addSignature(signature);
  });
  return safeTransaction;
};

/**
 * Returns a Safe transaction ready to be signed by the owners.
 *
 * @param createTransactionProps - The createTransaction props
 * @returns The Safe transaction
 * @throws "Invalid empty array of transactions"
 */
const createTransaction = async ({
  safeContract,
  signer,
  safeTransactionData,
  onlyCalls = false,
  options,
}: CreateTransactionProps): Promise<SafeTransaction> => {
  const safeVersion = await safeContract.VERSION();
  if (!hasSafeFeature(SAFE_FEATURES.ACCOUNT_ABSTRACTION, safeVersion)) {
    throw new Error(
      'Account Abstraction functionality is not available for Safes with version lower than v1.3.0'
    );
  }

  if (
    isMetaTransactionArray(safeTransactionData) &&
    safeTransactionData.length === 0
  ) {
    throw new Error('Invalid empty array of transactions');
  }

  let newTransaction: SafeTransactionDataPartial;
  if (
    isMetaTransactionArray(safeTransactionData) &&
    safeTransactionData.length > 1
  ) {
    const multiSendContract = onlyCalls
      ? getMultiSendCallOnlyContract({
          signer,
          safeVersion: DEFAULT_SAFE_VERSION,
        })
      : getMultiSendContract({ signer, safeVersion: DEFAULT_SAFE_VERSION });

    const multiSendData = encodeMultiSendData(
      safeTransactionData.map(standardizeMetaTransactionData)
    );

    const multiSendTransaction = {
      ...options,
      to: (await multiSendContract).address,
      value: '0',
      data: (await multiSendContract).interface.encodeFunctionData(
        'multiSend',
        [multiSendData]
      ),
      operation: OperationType.DelegateCall,
    };
    newTransaction = multiSendTransaction;
  } else {
    newTransaction = isMetaTransactionArray(safeTransactionData)
      ? { ...options, ...safeTransactionData[0] }
      : safeTransactionData;
  }

  if (!safeContract) {
    throw new Error('Safe is not deployed');
  }
  return new EthSafeTransaction(
    await standardizeSafeTransactionData({
      safeContract,
      signer,
      tx: newTransaction,
    })
  );
};

/**
 * Copies a Safe transaction
 *
 * @param safeTransaction - The Safe transaction
 * @returns The new Safe transaction
 */
export const copyTransaction = async (
  safeContract: Safe_V1_3_0,
  signer: Signer,
  safeTransaction: SafeTransaction
): Promise<SafeTransaction> => {
  const safeVersion = (await safeContract.VERSION()) as SafeVersion;
  const multiSendDeploymentDetails =
    await getMultiSendContractDeploymentDetails(
      safeVersion,
      await signer.getChainId()
    );
  const multiSendCallOnlyDeploymentDetails =
    await getMultiSendCallOnlyContractDeploymentDetails(
      safeVersion,
      await signer.getChainId()
    );
  const signedSafeTransaction = await createTransaction({
    safeContract,
    signer,
    multiSendContractAddress: multiSendDeploymentDetails.defaultAddress,
    multiSendCallOnlyContractAddress:
      multiSendCallOnlyDeploymentDetails.defaultAddress,
    safeTransactionData: safeTransaction.data,
  });
  safeTransaction.signatures.forEach((signature) => {
    signedSafeTransaction.addSignature(signature);
  });
  return signedSafeTransaction;
};

/**
 * Returns the transaction hash of a Safe transaction.
 *
 * @param safeTransaction - The Safe transaction
 * @returns The transaction hash of the Safe transaction
 */
export const getTransactionHash = async (
  safeContract: Safe_V1_3_0,
  safeTransaction: SafeTransaction
): Promise<string> => {
  if (!safeContract) {
    throw new Error('Safe is not deployed');
  }
  const sftd = safeTransaction.data;
  const txHash = await safeContract.getTransactionHash(
    sftd.to,
    sftd.value,
    sftd.data,
    sftd.operation,
    sftd.safeTxGas,
    sftd.baseGas,
    sftd.gasPrice,
    sftd.gasToken,
    sftd.refundReceiver,
    sftd.nonce
  );
  return txHash;
};

/**
 * Returns a list of owners who have approved a specific Safe transaction.
 *
 * @param txHash - The Safe transaction hash
 * @returns The list of owners
 */
export const getOwnersWhoApprovedTx = async (
  safeContract: Safe_V1_3_0,
  txHash: string
): Promise<string[]> => {
  if (!safeContract) {
    throw new Error('Safe is not deployed');
  }

  const owners = await getOwners(safeContract);
  const ownersWhoApproved: string[] = [];
  for (const owner of owners) {
    const approved = await safeContract.approvedHashes(owner, txHash);
    if (approved.gt(0)) {
      ownersWhoApproved.push(owner);
    }
  }
  return ownersWhoApproved;
};

/**
 * Returns the list of Safe owner accounts.
 *
 * @returns The list of owners
 */
export const getOwners = async (
  safeContract: Safe_V1_3_0
): Promise<string[]> => {
  if (!safeContract) {
    throw new Error('Safe is not deployed');
  }
  const owners = await safeContract.getOwners();
  return [...owners];
};

/**
 * Returns the Safe threshold.
 *
 * @returns The Safe threshold
 */
export const getThreshold = async (
  safeContract: Safe_V1_3_0
): Promise<number> => {
  if (!safeContract) {
    throw new Error('Safe is not deployed');
  }
  return (await safeContract.getThreshold()).toNumber();
};

export function isMetaTransactionArray(
  safeTransactions: SafeTransactionDataPartial | MetaTransactionData[]
): safeTransactions is MetaTransactionData[] {
  return (safeTransactions as MetaTransactionData[])?.length !== undefined;
}

function encodeMultiSendData(txs: MetaTransactionData[]): string {
  return '0x' + txs.map((tx) => encodeMetaTransaction(tx)).join('');
}

function encodeMetaTransaction(tx: MetaTransactionData): string {
  const data = arrayify(tx.data);
  const encoded = solidityPack(
    ['uint8', 'address', 'uint256', 'uint256', 'bytes'],
    [tx.operation, tx.to, tx.value, data.length, data]
  );
  return encoded.slice(2);
}

export async function standardizeSafeTransactionData({
  safeContract,
  signer,
  tx,
}: StandardizeSafeTransactionDataProps): Promise<SafeTransactionData> {
  const standardizedTxs = {
    to: tx.to,
    value: tx.value,
    data: tx.data,
    operation: tx.operation ?? OperationType.Call,
    baseGas: tx.baseGas ?? '0',
    gasPrice: tx.gasPrice ?? '0',
    gasToken: tx.gasToken || ZERO_ADDRESS,
    refundReceiver: tx.refundReceiver || ZERO_ADDRESS,
    nonce:
      tx.nonce ?? (safeContract ? (await safeContract.nonce()).toNumber() : 0),
  };

  if (typeof tx.safeTxGas !== 'undefined') {
    return {
      ...standardizedTxs,
      safeTxGas: tx.safeTxGas,
    };
  }

  if (!safeContract) {
    throw new Error('Safe is not deployed');
  }
  const safeVersion = (await safeContract.VERSION()) as SafeVersion;

  if (!safeContract) {
    throw new Error('Safe is not deployed');
  }

  const safeTxGas = await estimateGas(
    safeVersion,
    safeContract,
    signer,
    standardizedTxs.to,
    standardizedTxs.value,
    standardizedTxs.data,
    standardizedTxs.operation
  );
  return {
    ...standardizedTxs,
    safeTxGas,
  };
}

export function sameString(str1: string, str2: string): boolean {
  return str1.toLowerCase() === str2.toLowerCase();
}

export function standardizeMetaTransactionData(
  tx: SafeTransactionDataPartial
): MetaTransactionData {
  const standardizedTxs: MetaTransactionData = {
    ...tx,
    operation: tx.operation ?? OperationType.Call,
  };
  return standardizedTxs;
}

/**
 * Returns the Safe Transaction encoded
 *
 * @async
 * @param {SafeTransaction} safeTransaction - The Safe transaction to be encoded.
 * @returns {Promise<string>} The encoded transaction
 *
 */
export const getEncodedTransaction = async (
  safeContract: Safe_V1_3_0,
  safeTransaction: SafeTransaction
): Promise<string> => {
  const encodedTransaction: string = safeContract.interface.encodeFunctionData(
    'execTransaction',
    [
      safeTransaction.data.to,
      safeTransaction.data.value,
      safeTransaction.data.data,
      safeTransaction.data.operation,
      safeTransaction.data.safeTxGas,
      safeTransaction.data.baseGas,
      safeTransaction.data.gasPrice,
      safeTransaction.data.gasToken,
      safeTransaction.data.refundReceiver,
      safeTransaction.encodedSignatures(),
    ]
  ) as string;

  return encodedTransaction;
};
