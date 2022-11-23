import { BigDecimal, BigInt } from '@graphprotocol/graph-ts'

import { User, Vault, VaultUserBalance } from '../../generated/schema'

import { BIG_DECIMAL_0 } from '../utils/constants'
import { getMetric } from './metric'
import { saveVault } from './vault'


export function createVaultUserBalance(vault: Vault, user: User, timestamp: BigInt): VaultUserBalance {
  const users = vault.users
  users.push(user.id)
  vault.users = users
  saveVault(vault, timestamp)

  const vubID = vault.id + user.id
  const vub = new VaultUserBalance(vubID)
  vub.timestamp = timestamp

  vub.vault = vault.id
  vub.user = user.id
  vub.amount = BIG_DECIMAL_0
  vub.value = BIG_DECIMAL_0
  vub.earned = BIG_DECIMAL_0
  vub.earnedUSD = BIG_DECIMAL_0

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

function getVaultUserBalance(vaultId: string, userId: string): VaultUserBalance | null {
  const vubID = vaultId + userId
  const vub = VaultUserBalance.load(vubID)

  return vub
}

export function updateVaultUserBalance(vub: VaultUserBalance, timestamp: BigInt): void {
  vub.timestamp = timestamp
  vub.save()
}

export function getTotalVaultsBalance(userId: string): BigDecimal {
  const vaults = getMetric().vaults

  let totalBalances = BIG_DECIMAL_0
  for (let i = 0; i < vaults.length; i++) {
    const vub = getVaultUserBalance(vaults[i], userId)
    if (vub && vub.staked > BIG_DECIMAL_0) {
      totalBalances = totalBalances.plus(vub.staked)
    }
  }

  return totalBalances
}
