import { Signer } from '@ethersproject/abstract-signer';
import { OperationType, SafeVersion } from '@safe-global/safe-core-sdk-types';
import { Gnosis_safe as Safe_V1_3_0 } from 'types/typechain/@safe-global/safe-deployments/v1.3.0/Gnosis_safe';
import { getSimulateTxAccessorContract } from '../contracts/safeDeploymentContracts';

export async function estimateGas(
  safeVersion: SafeVersion,
  safeContract: Safe_V1_3_0,
  signer: Signer,
  to: string,
  valueInWei: string,
  data: string,
  operation: OperationType
) {
  const simulateTxAccessorContract = await getSimulateTxAccessorContract({
    signer,
    safeVersion,
  });
  const transactionDataToEstimate =
    simulateTxAccessorContract.interface.encodeFunctionData('simulate', [
      to,
      valueInWei,
      data,
      operation,
    ]);
  const safeFunctionToEstimate = safeContract.interface.encodeFunctionData(
    'simulateAndRevert',
    [await simulateTxAccessorContract.address, transactionDataToEstimate]
  );
  const safeAddress = safeContract.address;
  const transactionToEstimateGas = {
    to: safeAddress,
    value: '0',
    data: safeFunctionToEstimate,
    from: safeAddress,
  };

  try {
    const encodedResponse = await signer.call(transactionToEstimateGas);

    return Number('0x' + encodedResponse.slice(184).slice(0, 10)).toString();
  } catch (error: any) {
    return parseSafeTxGasErrorResponse(error);
  }
}

function decodeSafeTxGas(encodedSafeTxGas: string): string {
  return Number('0x' + encodedSafeTxGas.slice(184).slice(0, 10)).toString();
}

function parseSafeTxGasErrorResponse(error: any) {
  // Ethers
  if (error?.error?.body) {
    const revertData = JSON.parse(error.error.body).error.data;
    if (revertData && revertData.startsWith('Reverted ')) {
      const [, encodedResponse] = revertData.split('Reverted ');
      const safeTxGas = decodeSafeTxGas(encodedResponse);

      return safeTxGas;
    }
  }

  // Web3
  const [, encodedResponse] = error.message.split('return data: ');
  const safeTxGas = decodeSafeTxGas(encodedResponse);

  return safeTxGas;
}
