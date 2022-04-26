import { BigInt } from '@graphprotocol/graph-ts'

import { BIG_DECIMAL_0, BIG_INT_1 } from '../utils/constants'

import { User, Vault, VaultUserBalance } from '../../generated/schema'


export function createVaultUserBalance(vault: Vault, user: User, timestamp: BigInt): VaultUserBalance {
  const vubID = vault.id + user.id
  let vub = new VaultUserBalance(vubID)
  vub.timestamp = timestamp

  vub.vault = vault.id
  vub.user = user.id
  vub.amount = BIG_DECIMAL_0
  vub.value = BIG_DECIMAL_0

  vub.save()

  return vub as VaultUserBalance
}

export function getOrCreateVaultUserBalance(vault: Vault, user: User, timestamp: BigInt): VaultUserBalance {
  const vubID = vault.id + user.id
  let vub = VaultUserBalance.load(vubID)

  if (vub === null) {
    vub = createVaultUserBalance(vault, user, timestamp)
  }

  return vub as VaultUserBalance
}

export function updateVaultUserBalance(vub: VaultUserBalance, timestamp: BigInt): void {
  vub.timestamp = timestamp
  vub.save()
}
