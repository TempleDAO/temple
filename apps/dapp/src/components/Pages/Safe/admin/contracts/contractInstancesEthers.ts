import { Signer } from '@ethersproject/abstract-signer'
// import { Gnosis_safe__factory as SafeMasterCopy_V1_0_0 } from 'types/typechain/safe/src/ethers-v5/v1.0.0/factories/Gnosis_safe__factory'
// import { Proxy_factory__factory as SafeProxyFactory_V1_0_0 } from 'types/typechain/safe/src/ethers-v5/v1.0.0/factories/Proxy_factory__factory'
// import { Gnosis_safe__factory as SafeMasterCopy_V1_1_1 } from 'types/typechain/safe/src/ethers-v5/v1.1.1/factories/Gnosis_safe__factory'
// import { Proxy_factory__factory as SafeProxyFactory_V1_1_1 } from 'types/typechain/safe/src/ethers-v5/v1.1.1/factories/Proxy_factory__factory'
// import { Gnosis_safe__factory as SafeMasterCopy_V1_2_0 } from 'types/typechain/safe/src/ethers-v5/v1.2.0/factories/Gnosis_safe__factory'
// import { Multi_send__factory as MultiSend_V1_1_1 } from 'types/typechain/safe/src/ethers-v5/v1.1.1/factories/Multi_send__factory'
import { Compatibility_fallback_handler__factory as CompatibilityFallbackHandler_V1_3_0 } from 'types/typechain/safe/src/ethers-v5/v1.3.0/factories/Compatibility_fallback_handler__factory'
import { Create_call__factory as CreateCall_V1_3_0 } from 'types/typechain/safe/src/ethers-v5/v1.3.0/factories/Create_call__factory'
import { Safe__factory as SafeMasterCopy_V1_4_1 } from 'types/typechain/safe/src/ethers-v5/v1.4.1/factories/Safe__factory'
import { Gnosis_safe__factory as SafeMasterCopy_V1_3_0 } from 'types/typechain/safe/src/ethers-v5/v1.3.0/factories/Gnosis_safe__factory'
import { Multi_send__factory as MultiSend_V1_3_0 } from 'types/typechain/safe/src/ethers-v5/v1.3.0/factories/Multi_send__factory'
import { Multi_send_call_only__factory as MultiSendCallOnly_V1_3_0 } from 'types/typechain/safe/src/ethers-v5/v1.3.0/factories/Multi_send_call_only__factory'
import { Proxy_factory__factory as SafeProxyFactory_V1_3_0 } from 'types/typechain/safe/src/ethers-v5/v1.3.0/factories/Proxy_factory__factory'
import { Sign_message_lib__factory as SignMessageLib_V1_3_0 } from 'types/typechain/safe/src/ethers-v5/v1.3.0/factories/Sign_message_lib__factory'
import { Simulate_tx_accessor__factory as SimulateTxAccessor_V1_3_0 } from 'types/typechain/safe/src/ethers-v5/v1.3.0/factories/Simulate_tx_accessor__factory'
import { Compatibility_fallback_handler__factory as CompatibilityFallbackHandler_V1_4_1 } from 'types/typechain/safe/src/ethers-v5/v1.4.1/factories/Compatibility_fallback_handler__factory'
import { Create_call__factory as CreateCall_V1_4_1 } from 'types/typechain/safe/src/ethers-v5/v1.4.1/factories/Create_call__factory'
import { Multi_send__factory as MultiSend_V1_4_1 } from 'types/typechain/safe/src/ethers-v5/v1.4.1/factories/Multi_send__factory'
import { Multi_send_call_only__factory as MultiSendCallOnly_V1_4_1 } from 'types/typechain/safe/src/ethers-v5/v1.4.1/factories/Multi_send_call_only__factory'
import { Safe_proxy_factory__factory as SafeProxyFactory_V1_4_1 } from 'types/typechain/safe/src/ethers-v5/v1.4.1/factories/Safe_proxy_factory__factory'
import { Sign_message_lib__factory as SignMessageLib_V1_4_1 } from 'types/typechain/safe/src/ethers-v5/v1.4.1/factories/Sign_message_lib__factory'
import { Simulate_tx_accessor__factory as SimulateTxAccessor_V1_4_1 } from 'types/typechain/safe/src/ethers-v5/v1.4.1/factories/Simulate_tx_accessor__factory'
import { SafeVersion } from '@safe-global/safe-core-sdk-types'
import { Safe as Safe_V1_4_1 } from 'types/typechain/safe/src/ethers-v5/v1.4.1/Safe'
import { Gnosis_safe as Safe_V1_3_0 } from 'types/typechain/safe/src/ethers-v5/v1.3.0/Gnosis_safe'

export function getSafeContractInstance(
  safeVersion: SafeVersion,
  contractAddress: string,
  signer: Signer
): Safe_V1_4_1 | Safe_V1_3_0 {

  switch (safeVersion) {
    case '1.4.1':
      return SafeMasterCopy_V1_4_1.connect(contractAddress, signer)
    case '1.3.0':
      return SafeMasterCopy_V1_3_0.connect(contractAddress, signer)
    // case '1.2.0':
    //   return SafeMasterCopy_V1_2_0.connect(contractAddress, signer)
    // case '1.1.1':
    //   return SafeMasterCopy_V1_1_1.connect(contractAddress, signer)
    // case '1.0.0':
    //   return SafeMasterCopy_V1_0_0.connect(contractAddress, signer)
    default:
      throw new Error('Invalid Safe version')
  }
}

export function getCompatibilityFallbackHandlerContractInstance(
  safeVersion: SafeVersion,
  contractAddress: string,
  signer: Signer
) {
  switch (safeVersion) {
    case '1.4.1':
      return CompatibilityFallbackHandler_V1_4_1.connect(
        contractAddress,
        signer
      )
    case '1.3.0':
    case '1.2.0':
    case '1.1.1':
      return CompatibilityFallbackHandler_V1_3_0.connect(
        contractAddress,
        signer
      )
    default:
      throw new Error('Invalid Safe version')
  }
}

export function getMultiSendContractInstance(
  safeVersion: SafeVersion,
  contractAddress: string,
  signer: Signer
){
  switch (safeVersion) {
    case '1.4.1':
      return MultiSend_V1_4_1.connect(contractAddress, signer)
    case '1.3.0':
      return MultiSend_V1_3_0.connect(contractAddress, signer)
    // case '1.2.0':
    // case '1.1.1':
    // case '1.0.0':
    //   return MultiSend_V1_1_1.connect(contractAddress, signer)
    default:
      throw new Error('Invalid Safe version')
  }
}

export function getMultiSendCallOnlyContractInstance(
  safeVersion: SafeVersion,
  contractAddress: string,
  signer: Signer
) {
  switch (safeVersion) {
    case '1.4.1':
      return MultiSendCallOnly_V1_4_1.connect(
        contractAddress,
        signer
      )
    case '1.3.0':
    case '1.2.0':
    case '1.1.1':
    case '1.0.0':
      return MultiSendCallOnly_V1_3_0.connect(
        contractAddress,
        signer
      )
    default:
      throw new Error('Invalid Safe version')
  }
}

export function getSafeProxyFactoryContractInstance(
  safeVersion: SafeVersion,
  contractAddress: string,
  signer: Signer
) {
  switch (safeVersion) {
    case '1.4.1':
      return SafeProxyFactory_V1_4_1.connect(contractAddress, signer)
    case '1.3.0':
      return SafeProxyFactory_V1_3_0.connect(contractAddress, signer)
    // case '1.2.0':
    // case '1.1.1':
    //   return SafeProxyFactory_V1_1_1.connect(contractAddress, signer)
    // case '1.0.0':
    //   return SafeProxyFactory_V1_0_0.connect(contractAddress, signer)
    default:
      throw new Error('Invalid Safe version')
  }
}

export function getSignMessageLibContractInstance(
  safeVersion: SafeVersion,
  contractAddress: string,
  signer: Signer
) {
  switch (safeVersion) {
    case '1.4.1':
      return SignMessageLib_V1_4_1.connect(contractAddress, signer)
    case '1.3.0':
      return SignMessageLib_V1_3_0.connect(contractAddress, signer)
    default:
      throw new Error('Invalid Safe version')
  }
}

export function getCreateCallContractInstance(
  safeVersion: SafeVersion,
  contractAddress: string,
  signer: Signer
) {
  switch (safeVersion) {
    case '1.4.1':
      return CreateCall_V1_4_1.connect(contractAddress, signer)
    case '1.3.0':
    case '1.2.0':
    case '1.1.1':
    case '1.0.0':
      return CreateCall_V1_3_0.connect(contractAddress, signer)
    default:
      throw new Error('Invalid Safe version')
  }
}

export function getSimulateTxAccessorContractInstance(
  safeVersion: SafeVersion,
  contractAddress: string,
  signer: Signer
) {
  switch (safeVersion) {
    case '1.4.1':
      return SimulateTxAccessor_V1_4_1.connect(
        contractAddress,
        signer
      )
    case '1.3.0':
      return SimulateTxAccessor_V1_3_0.connect(
        contractAddress,
        signer
      )
    default:
      throw new Error('Invalid Safe version')
  }
}
