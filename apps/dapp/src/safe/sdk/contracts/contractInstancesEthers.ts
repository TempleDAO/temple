import { Signer } from '@ethersproject/abstract-signer';
import { Gnosis_safe__factory as SafeMasterCopy_V1_3_0 } from 'types/typechain/factories/@safe-global/safe-deployments/v1.3.0/Gnosis_safe__factory';
import { Multi_send__factory as MultiSend_V1_3_0 } from 'types/typechain/factories/@safe-global/safe-deployments/v1.3.0/Multi_send__factory';
import { Multi_send_call_only__factory as MultiSendCallOnly_V1_3_0 } from 'types/typechain/factories/@safe-global/safe-deployments/v1.3.0/Multi_send_call_only__factory';
import { Simulate_tx_accessor__factory as SimulateTxAccessor_V1_3_0 } from 'types/typechain/factories/@safe-global/safe-deployments/v1.3.0/Simulate_tx_accessor__factory';
import { Gnosis_safe as Safe_V1_3_0 } from 'types/typechain/@safe-global/safe-deployments/v1.3.0/Gnosis_safe';

export function getSafeContractInstance(
  contractAddress: string,
  signer: Signer
): Safe_V1_3_0 {
  return SafeMasterCopy_V1_3_0.connect(contractAddress, signer);
}

export function getMultiSendContractInstance(
  contractAddress: string,
  signer: Signer
) {
  return MultiSend_V1_3_0.connect(contractAddress, signer);
}

export function getMultiSendCallOnlyContractInstance(
  contractAddress: string,
  signer: Signer
) {
  return MultiSendCallOnly_V1_3_0.connect(contractAddress, signer);
}

export function getSimulateTxAccessorContractInstance(
  contractAddress: string,
  signer: Signer
) {
  return SimulateTxAccessor_V1_3_0.connect(contractAddress, signer);
}
