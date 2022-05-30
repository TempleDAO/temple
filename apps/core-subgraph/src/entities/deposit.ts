import { Address, BigDecimal, ethereum } from '@graphprotocol/graph-ts'

import { Deposit as DepositEvent } from '../../generated/OpsManager/Vault'
import { Deposit } from '../../generated/schema'

import { getMetric, updateMetric } from './metric'
import { getOrCreateUser, updateUser } from './user'
import { getOrCreateToken } from './token'
import { toDecimal } from '../utils/decimals'
import { getVault, updateVault } from './vault'
import { getOrCreateVaultUserBalance, updateVaultUserBalance } from './vaultUserBalance'
import { getVaultGroup, updateVaultGroup } from './vaultGroup'
import { TEMPLE_LOCAL_ADDRESS } from '../utils/constants'
import { getTemplePrice } from '../utils/prices'


export function createDeposit(event: DepositEvent): Deposit {
  const metric = getMetric()

  const timestamp = event.block.timestamp
  const amount = toDecimal(event.params.amount, 18)
  const staked = toDecimal(event.params.amountStaked, 18)
  metric.tvl = metric.tvl.plus(staked)
  metric.volume = metric.volume.plus(amount)

  const tokenPrice = getTemplePrice()
  metric.tvlUSD = metric.tvlUSD.plus(staked.times(tokenPrice))
  metric.volumeUSD = metric.volumeUSD.plus(amount.times(tokenPrice))
  updateMetric(metric, timestamp)

  const deposit = new Deposit(event.transaction.hash.toHexString())
  deposit.timestamp = timestamp

  const vault = getVault(event.address as Address)
  deposit.vault = vault.id
  vault.tvl = vault.tvl.plus(staked)
  updateVault(vault, timestamp)

  const vaultGroup = getVaultGroup(vault.name)
  vaultGroup.tvl = vaultGroup.tvl.plus(staked)
  updateVaultGroup(vaultGroup, timestamp)

  const user = getOrCreateUser(event.params.account, timestamp)
  deposit.user = user.id
  user.depositsBalance = user.depositsBalance.plus(staked)
  user.totalBalance = user.totalBalance.plus(staked)
  updateUser(user, timestamp)

  const token = getOrCreateToken(TEMPLE_LOCAL_ADDRESS, timestamp)
  deposit.token = token.id

  const vub = getOrCreateVaultUserBalance(vault, user, timestamp)
  vub.amount = vub.amount.plus(amount)
  vub.staked = vub.staked.plus(staked)
  vub.value = vub.value.plus(staked.times(tokenPrice))
  vub.token = token.id
  updateVaultUserBalance(vub, timestamp)

  deposit.amount = amount
  deposit.staked = staked
  deposit.value = staked.times(tokenPrice)
  deposit.save()

  const users = vault.users
  users.push(user.id)
  vault.users = users
  updateVault(vault, timestamp)

  return deposit as Deposit
}

export function getDeposit(eth_transaction: ethereum.Transaction): Deposit {
  const deposit = Deposit.load(eth_transaction.hash.toHexString())

  return deposit as Deposit
}
