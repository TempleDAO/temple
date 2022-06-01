import { Address, BigInt } from '@graphprotocol/graph-ts'

import { Vault } from '../../generated/schema'
import { Vault as VaultTemplate } from '../../generated/templates'
import { CreateVaultInstance } from '../../generated/OpsManager/OpsManager'
import { Vault as VaultContract } from '../../generated/OpsManager/Vault'

import { BIG_INT_1, BIG_DECIMAL_0 } from '../utils/constants'
import { getMetric, updateMetric } from './metric'
import { getOrCreateVaultGroup } from './vaultGroup'


export function createVault(event: CreateVaultInstance): void {
  const metric = getMetric()
  metric.vaultCount = metric.vaultCount.plus(BIG_INT_1)
  updateMetric(metric, event.block.timestamp)

  const vault = new Vault(event.params.vault.toHexString())
  vault.timestamp = event.block.timestamp

  const vaultContract = VaultContract.bind(event.params.vault)
  const name = vaultContract.name()
  const symbol = vaultContract.symbol()
  const templeToken = vaultContract.templeToken().toHexString()
  const periodDuration = vaultContract.periodDuration()
  const enterExitWindowDuration = vaultContract.enterExitWindowDuration()

  const p = vaultContract.shareBoostFactor().value0.toBigDecimal()
  const q = vaultContract.shareBoostFactor().value1.toBigDecimal()
  const shareBoostFactor = p.div(q)

  const joiningFee = vaultContract.joiningFee().toHexString()
  const firstPeriodStartTimestamp = vaultContract.firstPeriodStartTimestamp()

  vault.name = name
  vault.symbol = symbol
  vault.templeToken = templeToken
  vault.periodDuration = periodDuration
  vault.enterExitWindowDuration = enterExitWindowDuration
  vault.shareBoostFactor = shareBoostFactor
  vault.joiningFee = joiningFee
  vault.firstPeriodStartTimestamp = firstPeriodStartTimestamp
  vault.users = []
  vault.tvl = BIG_DECIMAL_0

  const vaultGroup = getOrCreateVaultGroup(name, event.block.timestamp)
  vault.vaultGroup = vaultGroup.id
  vault.save()

  VaultTemplate.create(event.params.vault)
}

export function getVault(address: Address): Vault {
  const vault = Vault.load(address.toHexString())

  return vault as Vault
}

export function updateVault(vault: Vault, timestamp: BigInt): void {
  vault.timestamp = timestamp
  vault.save()
}
