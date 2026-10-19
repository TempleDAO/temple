import styled from 'styled-components';
import {
  formatBigNumber,
  formatTemple,
  getBigNumberFromString,
} from 'components/Vault/utils';
import { ZERO } from 'utils/bigNumber';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { BigNumber, ethers } from 'ethers';
import { useWithdrawFromVault } from 'hooks/core/use-withdraw-from-vault';
import env from 'constants/env';
import { useConnectWallet } from '@web3-onboard/react';
import { TradeButton } from '../../NewUI/Home';
import { ERC20__factory, Vault__factory } from 'types/typechain';
import { useWallet } from 'providers/WalletProvider';
import { useNotification } from 'providers/NotificationProvider';
import { VaultButton } from '../../VaultPages/VaultContent';

const EMPTY_CLAIM_STATE = {
  claimSubvaultAddress: '',
  claimAmount: '',
};

const LEGACY_SUBVAULTS = [
  { id: '0x402832eC42305cf7123BC9903f693E944484b9c1', label: 'A' },
  { id: '0xa99980c64fc6c302377c39f21431217fcbaf39af', label: 'B' },
  { id: '0xb6226ad4fef850dc8b85a83bdc0d4aff9c61cd39', label: 'C' },
  { id: '0xd43cc1814bd87b67b318e4807cde50c090d01c1a', label: 'D' },
] as const;

export const ClaimFromVaults = () => {
  const [{ wallet }, connect] = useConnectWallet();
  const { walletAddress, signer } = useWallet();
  const [claimState, setClaimState] = useState(EMPTY_CLAIM_STATE);
  const [vaultBalances, setVaultBalances] = useState<
    Record<string, BigNumber>
  >({});

  const fetchVaultBalances = useCallback(async () => {
    if (!signer || !walletAddress) {
      setVaultBalances({});
      setClaimState(EMPTY_CLAIM_STATE);
      return;
    }

    const balances = await Promise.all(
      LEGACY_SUBVAULTS.map(async (vault) => {
        const vaultContract = Vault__factory.connect(vault.id, signer);
        const shares = await vaultContract.shareBalanceOf(walletAddress);
        const balance = await vaultContract.toTokenAmount(shares);

        return { vault, balance };
      })
    );
    const balancesByVault = balances.reduce<Record<string, BigNumber>>(
      (balances, { vault, balance }) => ({
        ...balances,
        [vault.id]: balance,
      }),
      {}
    );
    const selectedVault = balances.reduce((selected, candidate) =>
      candidate.balance.gt(selected.balance) ? candidate : selected
    );

    setVaultBalances(balancesByVault);
    setClaimState(
      selectedVault.balance.gt(ZERO)
        ? {
            claimSubvaultAddress: selectedVault.vault.id,
            claimAmount: formatBigNumber(selectedVault.balance),
          }
        : EMPTY_CLAIM_STATE
    );
  }, [signer, walletAddress]);

  useEffect(() => {
    fetchVaultBalances();
  }, [fetchVaultBalances]);

  const { withdrawEarly: earlyWithdrawRequest } = useWithdrawFromVault(
    '',
    async () => {
      await fetchVaultBalances();
      // AnalyticsService.captureEvent(AnalyticsEvent.Vault.Claim, { name: vault.id, amount });
    }
  );
  const [
    earlyWithdraw,
    { isLoading: earlyWithdrawIsLoading, error: earlyWithdrawError },
  ] = earlyWithdrawRequest;
  const [allowance, setAllowance] = useState(ZERO);
  const { openNotification } = useNotification();

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
        title: `Approved Withdraw`,
        hash: receipt.transactionHash,
      });
      fetchAllowance();
    } catch (e) {
      console.log(e);
      openNotification({
        title: `Failed to increase Withdraw allowance`,
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
  const getVaultBalances = () => {
    return LEGACY_SUBVAULTS.map((vault) => {
      const vaultBalance = vaultBalances[vault.id] || ZERO;

      return (
        <div key={vault.id}>
          <div>
            Subvault {vault.label}:{' '}
            <ClaimAmount
              isActive={vault.id == claimState.claimSubvaultAddress}
              onClick={() => claimAmountHandler(vault.id, vaultBalance)}
            >
              {formatTemple(vaultBalance)} TEMPLE
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
      <SubvaultContainer>{getVaultBalances()}</SubvaultContainer>

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
            label={'Approve Withdraw'}
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
