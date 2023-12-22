import { Signer } from '@ethersproject/abstract-signer'
import { Compatibility_fallback_handler__factory as CompatibilityFallbackHandler_V1_3_0 } from 'types/typechain/safe/v1.3.0/factories/Compatibility_fallback_handler__factory'
import { Create_call__factory as CreateCall_V1_3_0 } from 'types/typechain/safe/v1.3.0/factories/Create_call__factory'
import { Gnosis_safe__factory as SafeMasterCopy_V1_3_0 } from 'types/typechain/safe/v1.3.0/factories/Gnosis_safe__factory'
import { Multi_send__factory as MultiSend_V1_3_0 } from 'types/typechain/safe/v1.3.0/factories/Multi_send__factory'
import { Multi_send_call_only__factory as MultiSendCallOnly_V1_3_0 } from 'types/typechain/safe/v1.3.0/factories/Multi_send_call_only__factory'
import { Proxy_factory__factory as SafeProxyFactory_V1_3_0 } from 'types/typechain/safe/v1.3.0/factories/Proxy_factory__factory'
import { Sign_message_lib__factory as SignMessageLib_V1_3_0 } from 'types/typechain/safe/v1.3.0/factories/Sign_message_lib__factory'
import { Simulate_tx_accessor__factory as SimulateTxAccessor_V1_3_0 } from 'types/typechain/safe/v1.3.0/factories/Simulate_tx_accessor__factory'
import { Gnosis_safe as Safe_V1_3_0 } from 'types/typechain/safe/v1.3.0/Gnosis_safe'

export function getSafeContractInstance(
  contractAddress: string,
  signer: Signer
): Safe_V1_3_0 {

  return SafeMasterCopy_V1_3_0.connect(contractAddress, signer)
}

export function getCompatibilityFallbackHandlerContractInstance(
  contractAddress: string,
  signer: Signer
) {
  return CompatibilityFallbackHandler_V1_3_0.connect(
    contractAddress,
    signer
  )
}

export function getMultiSendContractInstance(
  contractAddress: string,
  signer: Signer
){
  return MultiSend_V1_3_0.connect(contractAddress, signer)
}

export function getMultiSendCallOnlyContractInstance(
  contractAddress: string,
  signer: Signer
) {
  return MultiSendCallOnly_V1_3_0.connect(
    contractAddress,
    signer
  )
}

export function getSafeProxyFactoryContractInstance(
  contractAddress: string,
  signer: Signer
) {
  return SafeProxyFactory_V1_3_0.connect(contractAddress, signer)
}

export function getSignMessageLibContractInstance(
  contractAddress: string,
  signer: Signer
) {
  return SignMessageLib_V1_3_0.connect(contractAddress, signer)
}

export function getCreateCallContractInstance(
  contractAddress: string,
  signer: Signer
) {
  return CreateCall_V1_3_0.connect(contractAddress, signer)
}

export function getSimulateTxAccessorContractInstance(
  contractAddress: string,
  signer: Signer
) {
  return SimulateTxAccessor_V1_3_0.connect(
    contractAddress,
    signer
  )
}
