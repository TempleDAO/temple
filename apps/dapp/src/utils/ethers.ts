import { ContractTransaction, PopulatedTransaction, Signer } from 'ethers';

const GAS_ESTIMATE_BUFFER_PERCENT = 25;

async function estimateAndMine(
  signer: Signer,
  populatedTransaction: PopulatedTransaction
) {
  const txn = await estimateAndSubmit(signer, populatedTransaction);
  return txn.wait();
}

async function estimateAndSubmit(
  signer: Signer,
  populatedTransaction: PopulatedTransaction
): Promise<ContractTransaction> {
  if (!signer.provider) {
    throw new Error('No provider found');
  }
  const gasEstimate = await signer.provider.estimateGas(populatedTransaction);
  const gas = gasEstimate.add(gasEstimate.div(GAS_ESTIMATE_BUFFER_PERCENT));

  populatedTransaction.gasLimit = gas;
  populatedTransaction.from = await signer.getAddress();

  return signer.sendTransaction(populatedTransaction);
}

export { estimateAndMine };
