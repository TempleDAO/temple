import { Signer } from '@ethersproject/abstract-signer';
import { SafeVersion } from '@safe-global/safe-core-sdk-types';
import {
  DeploymentFilter,
  SingletonDeployment,
  getMultiSendCallOnlyDeployment,
  getMultiSendDeployment,
  getSafeL2SingletonDeployment,
  getSafeSingletonDeployment,
  getSimulateTxAccessorDeployment,
} from '@safe-global/safe-deployments';
import { safeDeploymentsL1ChainIds, safeDeploymentsVersions } from './config';
import { ContractNetworkConfig } from '../utils/types';
import {
  getMultiSendCallOnlyContractInstance,
  getMultiSendContractInstance,
  getSafeContractInstance,
  getSimulateTxAccessorContractInstance,
} from './contractInstancesEthers';
import { Gnosis_safe as SafeMasterCopy_V1_3_0 } from 'types/typechain/@safe-global/safe-deployments/v1.3.0/Gnosis_safe';
import { Multi_send as MultiSend_V1_3_0 } from 'types/typechain/@safe-global/safe-deployments/v1.3.0/Multi_send';
import { Multi_send_call_only as MultiSendCallOnly_V1_3_0 } from 'types/typechain/@safe-global/safe-deployments/v1.3.0/Multi_send_call_only';
import { Simulate_tx_accessor as SimulateTxAccessor_V1_3_0 } from 'types/typechain/@safe-global/safe-deployments/v1.3.0/Simulate_tx_accessor';

interface GetContractInstanceProps {
  signer: Signer;
  safeVersion: SafeVersion;
  customContracts?: ContractNetworkConfig;
}

interface GetSafeContractInstanceProps extends GetContractInstanceProps {
  isL1SafeMasterCopy?: boolean;
  customSafeAddress?: string;
}

export function getSafeContractDeploymentDetails(
  safeVersion: SafeVersion,
  chainId: number,
  isL1SafeMasterCopy = false
): SingletonDeployment {
  const version = safeDeploymentsVersions[safeVersion].safeMasterCopyVersion;
  const filters: DeploymentFilter = {
    version,
    network: chainId.toString(),
    released: true,
  };
  if (safeDeploymentsL1ChainIds.includes(chainId) || isL1SafeMasterCopy) {
    const safeSingletonContractDetails = getSafeSingletonDeployment(filters);
    console.debug('using SafeContract L1', safeSingletonContractDetails);
    if (!safeSingletonContractDetails)
      throw Error('undefined safeSingletonContractDetails');
    return safeSingletonContractDetails;
  }
  const safeL2SingletonContractDetails = getSafeL2SingletonDeployment(filters);
  console.debug('using SafeContract L2', safeL2SingletonContractDetails);
  if (!safeL2SingletonContractDetails)
    throw Error('undefined safeL2SingletonContractDetails');
  return safeL2SingletonContractDetails;
}

export function getMultiSendCallOnlyContractDeploymentDetails(
  safeVersion: SafeVersion,
  chainId: number
): SingletonDeployment {
  const version = safeDeploymentsVersions[safeVersion].multiSendCallOnlyVersion;
  const multiSendCallOnlyContractDeploymentDetails =
    getMultiSendCallOnlyDeployment({
      version,
      network: chainId.toString(),
      released: true,
    });
  if (!multiSendCallOnlyContractDeploymentDetails)
    throw Error('undefined multiSendCallOnlyContractDeploymentDetails');
  return multiSendCallOnlyContractDeploymentDetails;
}

export function getMultiSendContractDeploymentDetails(
  safeVersion: SafeVersion,
  chainId: number
): SingletonDeployment {
  const version = safeDeploymentsVersions[safeVersion].multiSendVersion;
  const multiSendContractDeploymentDetails = getMultiSendDeployment({
    version,
    network: chainId.toString(),
    released: true,
  });
  if (!multiSendContractDeploymentDetails)
    throw Error('multiSendContractDeploymentDetails undefined');
  return multiSendContractDeploymentDetails;
}

export function getSimulateTxAccessorContractDeploymentDetails(
  safeVersion: SafeVersion,
  chainId: number
): SingletonDeployment {
  const version = safeDeploymentsVersions[safeVersion].createCallVersion;
  const simulateTxAccessorDeploymentDetails = getSimulateTxAccessorDeployment({
    version,
    network: chainId.toString(),
    released: true,
  });
  if (!simulateTxAccessorDeploymentDetails)
    throw Error('undefined simulateTxAccessorDeploymentDetails');
  return simulateTxAccessorDeploymentDetails;
}

export async function getSafeContract({
  signer,
  safeVersion,
  customSafeAddress,
  customContracts,
}: GetSafeContractInstanceProps): Promise<SafeMasterCopy_V1_3_0> {
  const safeContractDeploymentDetails = getSafeContractDeploymentDetails(
    safeVersion,
    await signer.getChainId()
  );
  const safeContract = getSafeContractInstance(
    customSafeAddress ??
      customContracts?.safeMasterCopyAddress ??
      safeContractDeploymentDetails.defaultAddress,
    signer
  );
  const isContractDeployed =
    (await signer.provider?.getCode(safeContract.address)) !== '0x';
  if (!isContractDeployed) {
    throw new Error(
      'SafeProxy contract is not deployed on the current network'
    );
  }
  return safeContract;
}

export async function getMultiSendContract({
  signer,
  safeVersion,
  customContracts,
}: GetContractInstanceProps): Promise<MultiSend_V1_3_0> {
  const multiSendContractDeploymentDetails =
    getMultiSendContractDeploymentDetails(
      safeVersion,
      await signer.getChainId()
    );
  const multiSendContract = getMultiSendContractInstance(
    customContracts?.safeMasterCopyAddress ??
      multiSendContractDeploymentDetails.defaultAddress,
    signer
  );
  const isContractDeployed = await signer.provider?.getCode(
    multiSendContract.address
  );
  if (!isContractDeployed) {
    throw new Error(
      'MultiSend contract is not deployed on the current network'
    );
  }
  return multiSendContract;
}

export async function getMultiSendCallOnlyContract({
  signer,
  safeVersion,
  customContracts,
}: GetContractInstanceProps): Promise<MultiSendCallOnly_V1_3_0> {
  const multiSendCallOnlyContractDeploymentDetails =
    getMultiSendCallOnlyContractDeploymentDetails(
      safeVersion,
      await signer.getChainId()
    );
  const multiSendCallOnlyContract = getMultiSendCallOnlyContractInstance(
    customContracts?.safeMasterCopyAddress ??
      multiSendCallOnlyContractDeploymentDetails.defaultAddress,
    signer
  );
  const isContractDeployed = await signer.provider?.getCode(
    multiSendCallOnlyContract.address
  );
  if (!isContractDeployed) {
    throw new Error(
      'MultiSendCallOnly contract is not deployed on the current network'
    );
  }
  return multiSendCallOnlyContract;
}

export async function getSimulateTxAccessorContract({
  signer,
  safeVersion,
  customContracts,
}: GetContractInstanceProps): Promise<SimulateTxAccessor_V1_3_0> {
  const simulateTxAccessorContractDeploymentDetails =
    getSimulateTxAccessorContractDeploymentDetails(
      safeVersion,
      await signer.getChainId()
    );
  const simulateTxAccessorContract = getSimulateTxAccessorContractInstance(
    customContracts?.safeMasterCopyAddress ??
      simulateTxAccessorContractDeploymentDetails.defaultAddress,
    signer
  );
  const isContractDeployed = await signer.provider?.getCode(
    simulateTxAccessorContract.address
  );
  if (!isContractDeployed) {
    throw new Error(
      'SimulateTxAccessor contract is not deployed on the current network'
    );
  }
  return simulateTxAccessorContract;
}
