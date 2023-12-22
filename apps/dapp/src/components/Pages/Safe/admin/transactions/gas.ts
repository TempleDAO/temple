import { BigNumber } from '@ethersproject/bignumber'
import { Signer } from '@ethersproject/abstract-signer'
import {
  OperationType,
  SafeVersion,
  SafeTransaction,
} from '@safe-global/safe-core-sdk-types'
import semverSatisfies from 'semver/functions/satisfies'
// import {} from '@'
import { Safe as Safe_V1_4_1 } from 'types/typechain/safe/src/ethers-v5/v1.4.1/Safe'
import { Gnosis_safe as Safe_V1_3_0 } from 'types/typechain/safe/src/ethers-v5/v1.3.0/Gnosis_safe'
import { getSafeContract, getSimulateTxAccessorContract } from '../contracts/safeDeploymentContracts'

// Every byte == 00 -> 4  Gas cost
const CALL_DATA_ZERO_BYTE_GAS_COST = 4

// Every byte != 00 -> 16 Gas cost (68 before Istanbul)
const CALL_DATA_BYTE_GAS_COST = 16


function estimateDataGasCosts(data: string): number {
  const bytes = data.match(/.{2}/g) as string[]

  return bytes.reduce((gasCost: number, currentByte: string) => {
    if (currentByte === '0x') {
      return gasCost + 0
    }

    if (currentByte === '00') {
      return gasCost + CALL_DATA_ZERO_BYTE_GAS_COST
    }

    return gasCost + CALL_DATA_BYTE_GAS_COST
  }, 0)
}

export async function estimateGas(
  safeVersion: SafeVersion,
  safeContract: Safe_V1_4_1 | Safe_V1_3_0,
  signer: Signer,
  to: string,
  valueInWei: string,
  data: string,
  operation: OperationType
) {
  const simulateTxAccessorContract = await getSimulateTxAccessorContract({signer, safeVersion});
  const transactionDataToEstimate = simulateTxAccessorContract.interface.encodeFunctionData('simulate', [
    to,
    valueInWei,
    data,
    operation
  ])
  const safeFunctionToEstimate = safeContract.interface.encodeFunctionData('simulateAndRevert', [
    await simulateTxAccessorContract.address,
    transactionDataToEstimate
  ])
  const safeAddress = safeContract.address
  const transactionToEstimateGas = {
    to: safeAddress,
    value: '0',
    data: safeFunctionToEstimate,
    from: safeAddress
  }

  try {
    const encodedResponse = await signer.call(transactionToEstimateGas)

    return Number('0x' + encodedResponse.slice(184).slice(0, 10)).toString()
  } catch (error: any) {
    return parseSafeTxGasErrorResponse(error)
  }
}

export async function estimateTxGas(
  safeContract: Safe_V1_4_1 | Safe_V1_3_0,
  signer: Signer,
  to: string,
  valueInWei: string,
  data: string,
  operation: OperationType
): Promise<string> {
  let txGasEstimation = BigNumber.from(0)
  const safeAddress = safeContract.address;

  const estimateData: string = safeContract.interface.encodeFunctionData('requiredTxGas' as any, [
    to,
    valueInWei,
    data,
    operation
  ])
  try {
    const estimateResponse = await signer.estimateGas({
      to: safeAddress,
      from: safeAddress,
      data: estimateData
    })
    txGasEstimation = BigNumber.from('0x' + estimateResponse.toString().substring(138)).add(10000)
  } catch (error) {}

  if (txGasEstimation.gt(0)) {
    const dataGasEstimation = estimateDataGasCosts(estimateData)
    let additionalGas = 10000
    for (let i = 0; i < 10; i++) {
      try {
        const estimateResponse = await signer.call({
          to: safeAddress,
          from: safeAddress,
          data: estimateData,
          gasPrice: '0',
          gasLimit: txGasEstimation.add(dataGasEstimation).add(additionalGas).toString()
        })
        if (estimateResponse !== '0x') {
          break
        }
      } catch (error) {}
      txGasEstimation = txGasEstimation.add(additionalGas)
      additionalGas *= 2
    }
    return txGasEstimation.add(additionalGas).toString()
  }

  try {
    const estimateGas = await signer.estimateGas({
      to,
      from: safeAddress,
      value: valueInWei,
      data
    })
    return estimateGas.toString()
  } catch (error) {
    if (operation === OperationType.DelegateCall) {
      return '0'
    }
    return Promise.reject(error)
  }
}

/**
 * This function estimates the safeTxGas of a Safe transaction.
 * The safeTxGas value represents the amount of gas required to execute the Safe transaction itself.
 * It does not include costs such as signature verification, transaction hash generation, nonce incrementing, and so on.
 *
 * The estimation method differs based on the version of the Safe:
 * - For versions >= 1.3.0, the simulate function defined in the simulateTxAccessor.sol Contract is used.
 * - For versions < 1.3.0, the deprecated requiredTxGas method defined in the GnosisSafe.sol contract is used.
 *
 * @async
 * @function estimateSafeTxGas
 * @param {Safe} safe - The Safe instance containing all the necessary information about the safe.
 * @param {SafeTransaction} safeTransaction - The transaction for which the safeTxGas is to be estimated.
 * @returns {Promise<string>} A Promise that resolves with the estimated safeTxGas as a string.
 *
 */
export async function estimateSafeTxGas(
  safe: Safe_V1_4_1 | Safe_V1_3_0,
  safeTransaction: SafeTransaction,
  signer: Signer,
): Promise<string> {
  const safeVersion = await safe.VERSION() as SafeVersion;

  if (semverSatisfies(safeVersion, '>=1.3.0')) {
    const safeTxGas = await estimateSafeTxGasWithSimulate(safe, safeTransaction, signer)

    return addExtraGasForSafety(safeTxGas)
  }

  // deprecated method to estimate the safeTxGas of a Safe transaction
  const safeTxGas = await estimateSafeTxGasWithRequiredTxGas(safe, safeTransaction, signer)

  return addExtraGasForSafety(safeTxGas)
}

/**
 * Increase the given safeTxGas gas amount by 5% as a security margin to avoid running out of gas.
 * In some contexts, the safeTxGas might be underestimated, leading to 'out of gas' errors during the Safe transaction execution
 *
 * @param {string} safeTxGas - The original safeTxGas gas amount.
 * @returns {string} The new safeTxGas gas amount, increased by 5% rounded.
 */
function addExtraGasForSafety(safeTxGas: string): string {
  const INCREASE_GAS_FACTOR = 1.05 // increase the gas by 5% as a security margin

  return Math.round(Number(safeTxGas) * INCREASE_GAS_FACTOR).toString()
}

/**
 * This function estimates the safeTxGas of a Safe transaction.
 * Using the deprecated method of requiredTxGas defined in the GnosisSafe contract. This method is meant to be used for Safe versions < 1.3.0.
 * see: https://github.com/safe-global/safe-contracts/blob/v1.2.0/contracts/GnosisSafe.sol#L276
 *
 * @async
 * @function estimateSafeTxGasWithRequiredTxGas
 * @param {Safe} safe - The Safe instance containing all the necessary information about the safe.
 * @param {SafeTransaction} safeTransaction - The transaction for which the safeTxGas is to be estimated.
 * @returns {Promise<string>} A Promise that resolves with the estimated safeTxGas as a string.
 *
 */
async function estimateSafeTxGasWithRequiredTxGas(
  safe: Safe_V1_4_1 | Safe_V1_3_0,
  safeTransaction: SafeTransaction,
  signer: Signer,
): Promise<string> {
  const isSafeDeployed = (await signer.provider?.getCode(safe.address)) !== "0x";
  const safeAddress = await safe.address
  const safeVersion = (await safe.VERSION()) as SafeVersion;
  const safeContract = await getSafeContract({safeVersion, signer, customSafeAddress: safeAddress});

  const transactionDataToEstimate: string = safeContract.interface.encodeFunctionData('requiredTxGas' as any, [
    safeTransaction.data.to,
    safeTransaction.data.value,
    safeTransaction.data.data,
    safeTransaction.data.operation
  ])

  const to = isSafeDeployed ? safeAddress : safeContract.address

  const transactionToEstimateGas = {
    to,
    value: '0',
    data: transactionDataToEstimate,
    from: safeAddress
  }
  try {
    const encodedResponse = await signer.call(transactionToEstimateGas)

    const safeTxGas = '0x' + encodedResponse.slice(-32)

    return safeTxGas

    // if the call throws an error we try to parse the returned value
  } catch (error: any) {
    try {
      const revertData = JSON.parse(error.error.body).error.data

      if (revertData && revertData.startsWith('Reverted ')) {
        const [, safeTxGas] = revertData.split('Reverted ')

        return Number(safeTxGas).toString()
      }
    } catch {
      return '0'
    }
  }

  return '0'
}

// TO-DO: Improve decoding
/*
  const simulateAndRevertResponse = signer.decodeParameters(
    ['bool', 'bytes'],
    encodedResponse
  )
  const returnedData = signer.decodeParameters(['uint256', 'bool', 'bytes'], simulateAndRevertResponse[1])
  */
function decodeSafeTxGas(encodedSafeTxGas: string): string {
  return Number('0x' + encodedSafeTxGas.slice(184).slice(0, 10)).toString()
}

function parseSafeTxGasErrorResponse(error: any) {
  // Ethers
  if (error?.error?.body) {
    const revertData = JSON.parse(error.error.body).error.data
    if (revertData && revertData.startsWith('Reverted ')) {
      const [, encodedResponse] = revertData.split('Reverted ')
      const safeTxGas = decodeSafeTxGas(encodedResponse)

      return safeTxGas
    }
  }

  // Web3
  const [, encodedResponse] = error.message.split('return data: ')
  const safeTxGas = decodeSafeTxGas(encodedResponse)

  return safeTxGas
}

/**
 * This function estimates the safeTxGas of a Safe transaction.
 * It uses the simulate function defined in the SimulateTxAccessor contract. This method is meant to be used for Safe versions >= 1.3.0.
 *
 * @async
 * @function estimateSafeTxGasWithSimulate
 * @param {Safe} safe - The Safe instance containing all the necessary information about the safe.
 * @param {SafeTransaction} safeTransaction - The transaction for which the safeTxGas is to be estimated.
 * @returns {Promise<string>} A Promise that resolves with the estimated safeTxGas as a string.
 *
 */
async function estimateSafeTxGasWithSimulate(
  safe: Safe_V1_4_1 | Safe_V1_3_0,
  safeTransaction: SafeTransaction,
  signer: Signer,
): Promise<string> {
  const isSafeDeployed = (await signer.provider?.getCode(safe.address)) !== "0x";
  const safeAddress = await safe.address
  const safeVersion = (await safe.VERSION()) as SafeVersion;
  const safeContract = await getSafeContract({safeVersion, signer, customSafeAddress: safeAddress});

  // new version of the estimation
  const simulateTxAccessorContract = await getSimulateTxAccessorContract({safeVersion, signer});

  const transactionDataToEstimate: string = simulateTxAccessorContract.interface.encodeFunctionData('simulate', [
    safeTransaction.data.to,
    safeTransaction.data.value,
    safeTransaction.data.data,
    safeTransaction.data.operation
  ])

  // if the Safe is not deployed we can use the singleton address to simulate
  const to = isSafeDeployed ? safeAddress : safeContract.address

  const safeFunctionToEstimate: string = safeContract.interface.encodeFunctionData('simulateAndRevert', [
    await simulateTxAccessorContract.address,
    transactionDataToEstimate
  ])

  const transactionToEstimateGas = {
    to,
    value: '0',
    data: safeFunctionToEstimate,
    from: safeAddress
  }

  try {
    const encodedResponse = await signer.call(transactionToEstimateGas)

    const safeTxGas = decodeSafeTxGas(encodedResponse)

    return safeTxGas

    // if the call throws an error we try to parse the returned value
  } catch (error: any) {
    return parseSafeTxGasErrorResponse(error)
  }

  return '0'
}
