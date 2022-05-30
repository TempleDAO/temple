import { Address, BigDecimal, ethereum } from '@graphprotocol/graph-ts'

import { Withdraw as WithdrawEvent } from '../../generated/OpsManager/Vault'
import { Withdraw } from '../../generated/schema'

import { getMetric, updateMetric } from './metric'
import { getOrCreateUser, updateUser } from './user'
import { getOrCreateToken } from './token'
import { toDecimal } from '../utils/decimals'
import { getVault, updateVault } from './vault'
import { getOrCreateVaultUserBalance, updateVaultUserBalance } from './vaultUserBalance'
import { getVaultGroup, updateVaultGroup } from './vaultGroup'
import { TEMPLE_LOCAL_ADDRESS } from '../utils/constants'
import { getTemplePrice } from '../utils/prices'


export function createWithdraw(event: WithdrawEvent): Withdraw {
  const metric = getMetric()

  const timestamp = event.block.timestamp
  const amount = toDecimal(event.params.amount, 18)
  metric.tvl = metric.tvl.minus(amount)
  metric.volume = metric.tvl.plus(amount)

  const tokenPrice = getTemplePrice()
  metric.tvlUSD = metric.tvlUSD.minus(amount.times(tokenPrice))
  metric.volumeUSD = metric.volumeUSD.plus(amount.times(tokenPrice))
  updateMetric(metric, timestamp)

  const withdraw = new Withdraw(event.transaction.hash.toHexString())
  withdraw.timestamp = timestamp

  const vault = getVault(event.address as Address)
  withdraw.vault = vault.id
  vault.tvl = vault.tvl.minus(amount)
  updateVault(vault, timestamp)

  const vaultGroup = getVaultGroup(vault.name)
  vaultGroup.tvl = vaultGroup.tvl.minus(amount)
  updateVaultGroup(vaultGroup, timestamp)

  const user = getOrCreateUser(event.params.account, timestamp)
  withdraw.user = user.id
  user.withdrawsBalance = user.withdrawsBalance.plus(amount)
  user.totalBalance = user.totalBalance.minus(amount)
  updateUser(user, timestamp)

  const token = getOrCreateToken(TEMPLE_LOCAL_ADDRESS, timestamp)
  withdraw.token = token.id

  const vub = getOrCreateVaultUserBalance(vault, user, timestamp)
  vub.amount = vub.amount.minus(amount)
  vub.staked = vub.staked.minus(amount)
  vub.value = vub.value.minus(amount.times(tokenPrice))
  vub.token = token.id
  updateVaultUserBalance(vub, timestamp)

  withdraw.amount = amount
  withdraw.value = amount.times(tokenPrice)
  withdraw.save()

  return withdraw as Withdraw
}

export function getWithdraw(eth_transaction: ethereum.Transaction): Withdraw {
  const withdraw = Withdraw.load(eth_transaction.hash.toHexString())

  return withdraw as Withdraw
}
