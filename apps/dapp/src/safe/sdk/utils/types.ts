import { Signer } from '@ethersproject/abstract-signer';
import {
  EthAdapter,
  MetaTransactionData,
  SafeTransactionDataPartial,
  SafeVersion,
} from '@safe-global/safe-core-sdk-types';
import { AbiItem } from 'web3-utils';
import { Gnosis_safe as Safe_V1_3_0 } from 'types/typechain/@safe-global/safe-deployments/v1.3.0/Gnosis_safe';

export type SafeTransactionOptionalProps = Pick<
  SafeTransactionDataPartial,
  'safeTxGas' | 'baseGas' | 'gasPrice' | 'gasToken' | 'refundReceiver' | 'nonce'
>;

export interface SafeAccountConfig {
  owners: string[];
  threshold: number;
  to?: string;
  data?: string;
  fallbackHandler?: string;
  paymentToken?: string;
  payment?: number;
  paymentReceiver?: string;
}

export interface SafeDeploymentConfig {
  saltNonce?: string;
  safeVersion?: SafeVersion;
}

export interface PredictedSafeProps {
  safeAccountConfig: SafeAccountConfig;
  safeDeploymentConfig?: SafeDeploymentConfig;
}

export interface ContractNetworkConfig {
  /** safeMasterCopyAddress - Address of the Safe Master Copy contract deployed on a specific network */
  safeMasterCopyAddress: string;
  /** safeMasterCopyAbi - Abi of the Safe Master Copy contract deployed on a specific network */
  safeMasterCopyAbi?: AbiItem | AbiItem[];
  /** safeProxyFactoryAddress - Address of the SafeProxyFactory contract deployed on a specific network */
  safeProxyFactoryAddress: string;
  /** safeProxyFactoryAbi - Abi of the SafeProxyFactory contract deployed on a specific network */
  safeProxyFactoryAbi?: AbiItem | AbiItem[];
  /** multiSendAddress - Address of the MultiSend contract deployed on a specific network */
  multiSendAddress: string;
  /** multiSendAbi - Abi of the MultiSend contract deployed on a specific network */
  multiSendAbi?: AbiItem | AbiItem[];
  /** multiSendCallOnlyAddress - Address of the MultiSendCallOnly contract deployed on a specific network */
  multiSendCallOnlyAddress: string;
  /** multiSendCallOnlyAbi - Abi of the MultiSendCallOnly contract deployed on a specific network */
  multiSendCallOnlyAbi?: AbiItem | AbiItem[];
  /** fallbackHandlerAddress - Address of the Fallback Handler contract deployed on a specific network */
  fallbackHandlerAddress: string;
  /** fallbackHandlerAbi - Abi of the Fallback Handler contract deployed on a specific network */
  fallbackHandlerAbi?: AbiItem | AbiItem[];
  /** signMessageLibAddress - Address of the SignMessageLib contract deployed on a specific network */
  signMessageLibAddress: string;
  /** signMessageLibAbi - Abi of the SignMessageLib contract deployed on a specific network */
  signMessageLibAbi?: AbiItem | AbiItem[];
  /** createCallAddress - Address of the CreateCall contract deployed on a specific network */
  createCallAddress: string;
  /** createCallAbi - Abi of the CreateCall contract deployed on a specific network */
  createCallAbi?: AbiItem | AbiItem[];
  /** simulateTxAccessorAddress - Address of the SimulateTxAccessor contract deployed on a specific network */
  simulateTxAccessorAddress: string;
  /** simulateTxAccessorAbi - Abi of the SimulateTxAccessor contract deployed on a specific network */
  simulateTxAccessorAbi?: AbiItem | AbiItem[];
}

export interface ContractNetworksConfig {
  /** id - Network id */
  [id: string]: ContractNetworkConfig;
}

type SafeConfigWithSafeAddressProps = {
  /** safeAddress - The address of the Safe account to use */
  safeAddress: string;
  /** predictedSafe - The configuration of the Safe that is not yet deployed */
  predictedSafe?: never;
};

export type SafeConfigProps = {
  /** ethAdapter - Ethereum adapter */
  ethAdapter: EthAdapter;
  /** isL1SafeMasterCopy - Forces to use the Safe L1 version of the contract instead of the L2 version */
  isL1SafeMasterCopy?: boolean;
  /** contractNetworks - Contract network configuration */
  contractNetworks?: ContractNetworksConfig;
};

export type SafeConfigWithSafeAddress = SafeConfigProps &
  SafeConfigWithSafeAddressProps;

type ConnectSafeConfigWithSafeAddressProps = {
  /** safeAddress - The address of the Safe account to use */
  safeAddress?: string;
  /** predictedSafe - The configuration of the Safe that is not yet deployed */
  predictedSafe?: never;
};

type ConnectSafeConfigWithPredictedSafeProps = {
  /** safeAddress - The address of the Safe account to use */
  safeAddress?: never;
  /** predictedSafe - The configuration of the Safe that is not yet deployed */
  predictedSafe?: PredictedSafeProps;
};

type ConnectSafeConfigProps = {
  /** ethAdapter - Ethereum adapter */
  ethAdapter?: EthAdapter;
  /** isL1SafeMasterCopy - Forces to use the Safe L1 version of the contract instead of the L2 version */
  isL1SafeMasterCopy?: boolean;
  /** contractNetworks - Contract network configuration */
  contractNetworks?: ContractNetworksConfig;
};

export type ConnectSafeConfigWithSafeAddress = ConnectSafeConfigProps &
  ConnectSafeConfigWithSafeAddressProps;
export type ConnectSafeConfigWithPredictedSafe = ConnectSafeConfigProps &
  ConnectSafeConfigWithPredictedSafeProps;
export type ConnectSafeConfig =
  | ConnectSafeConfigWithSafeAddress
  | ConnectSafeConfigWithPredictedSafe;

export interface CreateTransactionProps {
  safeContract: Safe_V1_3_0;
  signer: Signer;
  multiSendCallOnlyContractAddress: string;
  multiSendContractAddress: string;
  /** safeTransactionData - The transaction or transaction array to process */
  safeTransactionData: SafeTransactionDataPartial | MetaTransactionData[];
  /** options - The transaction array optional properties */
  options?: SafeTransactionOptionalProps;
  /** onlyCalls - Forces the execution of the transaction array with MultiSendCallOnly contract */
  onlyCalls?: boolean;
}

type StandardizeSafeTxDataWithSafeContractProps = {
  /** safeContract - The Safe contract to use */
  safeContract: Safe_V1_3_0;
  /** predictedSafe - The configuration of the Safe that is not yet deployed */
  predictedSafe?: never;
};

type StandardizeSafeTxDataWithPredictedSafeProps = {
  /** safeContract - The Safe contract to use */
  safeContract?: never;
  /** predictedSafe - The configuration of the Safe that is not yet deployed */
  predictedSafe: PredictedSafeProps;
};

interface StandardizeSafeTransactionData {
  signer: Signer;
  /** tx - Safe transaction */
  tx: SafeTransactionDataPartial;
  /** contractNetworks - Contract network configuration */
  contractNetworks?: ContractNetworksConfig;
}

export type StandardizeSafeTxDataWithSafeContract =
  StandardizeSafeTransactionData & StandardizeSafeTxDataWithSafeContractProps;
export type StandardizeSafeTxDataWithPredictedSafe =
  StandardizeSafeTransactionData & StandardizeSafeTxDataWithPredictedSafeProps;
export type StandardizeSafeTransactionDataProps =
  | StandardizeSafeTxDataWithSafeContract
  | StandardizeSafeTxDataWithPredictedSafe;

export interface GetContractInstanceProps {
  signer: Signer;
  safeVersion: SafeVersion;
  customContracts?: ContractNetworkConfig;
}
