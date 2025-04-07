import styled from 'styled-components';
import { useVaultContext } from '../../VaultContext';
import {
  formatBigNumber,
  formatTemple,
  getBigNumberFromString,
} from 'components/Vault/utils';
import { ZERO } from 'utils/bigNumber';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Vault, VaultGroup } from 'components/Vault/types';
import { BigNumber, ethers } from 'ethers';
import { useWithdrawFromVault } from 'hooks/core/use-withdraw-from-vault';
import env from 'constants/env';
import { useConnectWallet } from '@web3-onboard/react';
import { TradeButton } from '../../NewUI/Home';
import { ERC20__factory } from 'types/typechain';
import { useWallet } from 'providers/WalletProvider';
import { useNotification } from 'providers/NotificationProvider';
import { VaultButton } from '../../VaultPages/VaultContent';

const EMPTY_CLAIM_STATE = {
  claimSubvaultAddress: '',
  claimAmount: '',
};

export const ClaimFromVaults = () => {
  const [{ wallet }, connect] = useConnectWallet();
  const { walletAddress, signer } = useWallet();
  const {
    balances: { balances, isLoading: balancesIsLoading },
    vaultGroups: { vaultGroups, isLoading: vaultGroupsIsLoading },
    refreshVaultBalance,
  } = useVaultContext();
  const { withdrawEarly: earlyWithdrawRequest } = useWithdrawFromVault(
    '',
    async () => {
      await refreshVaultBalance(claimState.claimSubvaultAddress);
      // AnalyticsService.captureEvent(AnalyticsEvent.Vault.Claim, { name: vault.id, amount });
      setClaimState(EMPTY_CLAIM_STATE);
    }
  );
  const [
    earlyWithdraw,
    { isLoading: earlyWithdrawIsLoading, error: earlyWithdrawError },
  ] = earlyWithdrawRequest;
  const [assumedActiveVaultGroup, setAssumedActiveVaultGroup] = useState(
    {} as VaultGroup
  );
  const [allowance, setAllowance] = useState(ZERO);
  const { openNotification } = useNotification();

  // Initialize assumedActiveVaultGroup, claimState, zeroVaultBalance
  useEffect(() => {
    if (!balancesIsLoading && !vaultGroupsIsLoading) {
      const vaultGroup = vaultGroups[0];
      setAssumedActiveVaultGroup(vaultGroup);
      if (!vaultGroup) return;
      const initialVault = vaultGroup.vaults[0];
      setClaimState({
        claimSubvaultAddress: initialVault.id,
        claimAmount: formatBigNumber(
          balances[vaultGroup.id][initialVault.id].balance || ZERO
        ),
      });
    }
  }, [balancesIsLoading, balances, vaultGroupsIsLoading, vaultGroups]);

  const [claimState, setClaimState] = useState(EMPTY_CLAIM_STATE);

  const fetchAllowance = useCallback(async () => {
    if (!signer || !walletAddress) return;
    const subvaultContract = new ERC20__factory(signer).attach(
      claimState.claimSubvaultAddress
    );
    const allowance = await subvaultContract.allowance(
      walletAddress,
      env.contracts.vaultEarlyExit
    );
    setAllowance(allowance);
  }, [signer, walletAddress, claimState.claimSubvaultAddress]);

  useEffect(() => {
    fetchAllowance();
  }, [fetchAllowance]);

  // Approve Early Withdraw to spend Subvault tokens
  const approve = async () => {
    if (!signer || !wallet) return;
    const subvaultContract = new ERC20__factory(signer).attach(
      claimState.claimSubvaultAddress
    );
    try {
      const tx = await subvaultContract.approve(
        env.contracts.vaultEarlyExit,
        ethers.constants.MaxUint256
      );
      const receipt = await tx.wait();
      openNotification({
        title: `Approved Early Withdraw`,
        hash: receipt.transactionHash,
      });
      fetchAllowance();
    } catch (e) {
      console.log(e);
      openNotification({
        title: `Failed to increase Early Withdraw allowance`,
        hash: '',
      });
    }
  };

  const claimAmountHandler = (contract: string, value: BigNumber) => {
    setClaimState({
      claimSubvaultAddress: contract,
      claimAmount: formatBigNumber(value),
    });
  };

  const formatErrorMessage = (errorMessage: string) => {
    const boundary = errorMessage.indexOf('(');
    if (boundary > 0) return errorMessage.substring(0, boundary - 1);
    return errorMessage.substring(0, 20).concat('...');
  };

  // Return component for all subvault balances
  const getVaultBalances = (vaults: Vault[] | undefined) => {
    console.debug('getVaultBalances::vaults', vaults);
    if (!vaults) return [];
    return vaults.map((vault) => {
      const vaultGroupBalances = balances[vaultGroups[0].id];
      const vaultBalance = vaultGroupBalances[vault.id] || {};

      return (
        <div key={vault.id}>
          <div>
            Subvault {vault.label}:{' '}
            <ClaimAmount
              isActive={vault.id == claimState.claimSubvaultAddress}
              onClick={() =>
                claimAmountHandler(vault.id, vaultBalance.balance || ZERO)
              }
            >
              {formatTemple(vaultBalance.balance)} TEMPLE
            </ClaimAmount>
          </div>
        </div>
      );
    });
  };

  const insufficientAllowance = useMemo(
    () => allowance.lt(getBigNumberFromString(claimState.claimAmount)),
    [allowance, claimState.claimAmount]
  );

  return (
    <ClaimContainer>
      <ClaimTitle>Claim from Vaults</ClaimTitle>
      <ClaimSubtitle>Select Vault for Withdrawal</ClaimSubtitle>
      <SubvaultContainer>
        {getVaultBalances(assumedActiveVaultGroup?.vaults)}
      </SubvaultContainer>

      {!!earlyWithdrawError && (
        <ErrorLabel>
          {formatErrorMessage(earlyWithdrawError.message) ||
            'Something went wrong'}
        </ErrorLabel>
      )}

      <ButtonContainer>
        {!wallet ? (
          <TradeButton
            label={`Connect`}
            onClick={() => {
              connect();
            }}
          />
        ) : Number(claimState.claimAmount) === 0 ? (
          <ClaimButton
            label={`Nothing to Claim`}
            disabled={true}
            onClick={async () => {
              await earlyWithdraw(
                claimState.claimSubvaultAddress,
                claimState.claimAmount
              );
            }}
          />
        ) : insufficientAllowance ? (
          <ClaimButton
            label={'Approve Early Withdraw'}
            onClick={async () => {
              await approve();
            }}
          />
        ) : (
          <ClaimButton
            label={`Redeem ${formatTemple(
              Number(claimState.claimAmount)
            )} TEMPLE`}
            disabled={earlyWithdrawIsLoading || !claimState.claimAmount}
            onClick={async () => {
              await earlyWithdraw(
                claimState.claimSubvaultAddress,
                claimState.claimAmount
              );
            }}
          />
        )}
      </ButtonContainer>
    </ClaimContainer>
  );
};

const ButtonContainer = styled.div`
  display: flex;
  width: 100%;
  justify-content: center;
`;

const ErrorLabel = styled.span`
  color: ${({ theme }) => theme.palette.enclave.chaos};
  display: block;
  margin: 1rem 0;
`;

const ClaimAmount = styled.span<{ isActive: boolean }>`
  text-decoration: underline;
  color: ${({ isActive, theme }) =>
    isActive ? theme.palette.brandLight : theme.palette.brand75};
  font-weight: ${(props) => (props.isActive ? `bold` : `normal`)};
  cursor: pointer;
  &hover {
    color: ${({ theme }) => theme.palette.brandLight};
  }
`;

const SubvaultContainer = styled.div`
  display: flex;
  flex-direction: column;
  padding-bottom: 1.5rem;
  gap: 0.5rem;
`;

const ClaimButton = styled(VaultButton)`
  background: ${({ theme }) => theme.palette.gradients.dark};
  border: 1px solid #95613f;
  box-shadow: 0px 0px 20px rgba(222, 92, 6, 0.4);
  border-radius: 0.75rem;
  font-weight: 700;
  font-size: 1rem;
  letter-spacing: 0.1rem;
  text-transform: uppercase;
`;

const ClaimSubtitle = styled.div`
  font-size: 1.15rem;
  letter-spacing: 0.05rem;
  padding-bottom: 0.5rem;
`;

const ClaimTitle = styled.div`
  padding-bottom: 1rem;
  color: ${({ theme }) => theme.palette.brandLight};
  font-size: 36px;
  line-height: 42px;
  color: #ffdec9;
`;

const ClaimContainer = styled.div`
  display: flex;
  flex-direction: column;
  color: ${({ theme }) => theme.palette.brand};
  width: 350px;
  align-items: center;
`;

export default ClaimFromVaults;
