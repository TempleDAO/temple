import { Popover } from 'components/Popover';
import styled from 'styled-components';
import { useVaultContext } from '../VaultContext';
import { formatBigNumber, formatTemple } from 'components/Vault/utils';
import { format, isDate } from 'date-fns';
import { ZERO } from 'utils/bigNumber';
import { useEffect, useState } from 'react';
import { Vault, VaultGroup } from 'components/Vault/types';
import { BigNumber } from 'ethers';
import { useWithdrawFromVault } from 'hooks/core/use-withdraw-from-vault';
import { VaultButton } from '../VaultPages/VaultContent';
import { useTokenContractAllowance } from 'hooks/core/use-token-contract-allowance';
import { VaultBalance } from 'hooks/core/use-vault-group-token-balance';
import env from 'constants/env';
import _ from 'lodash';
import { ContinuousColorLegend } from 'react-vis';

interface IProps {
  isOpen: boolean;
  onClose: () => void;
}

const EMPTY_CLAIM_STATE = {
  claimSubvaultAddress: '',
  isEarly: false,
  claimAmount: '',
};

export const ClaimModal: React.FC<IProps> = ({ isOpen, onClose }) => {
  const {
    balances: { balances, isLoading: balancesIsLoading },
    vaultGroups: { vaultGroups, isLoading: vaultGroupsIsLoading },
    refreshVaultBalance,
  } = useVaultContext();

  const { withdrawFromVault: withdrawRequest, withdrawEarly: earlyWithdrawRequest } = useWithdrawFromVault(
    '',
    async () => {
      await refreshVaultBalance(claimState.claimSubvaultAddress);
      // AnalyticsService.captureEvent(AnalyticsEvent.Vault.Claim, { name: vault.id, amount });
      clearClaimState();
    }
  );

  const [withdrawFromVault, { isLoading: withdrawIsLoading, error: withdrawError }] = withdrawRequest;
  const [earlyWithdraw, { isLoading: earlyWithdrawIsLoading, error: earlyWithdrawError }] = earlyWithdrawRequest;

  const [assumedActiveVaultGroup, setAssumedActiveVaultGroup] = useState({} as VaultGroup);

  useEffect(() => {
    if (!balancesIsLoading && !vaultGroupsIsLoading) {
      setAssumedActiveVaultGroup(vaultGroups[0]);
      const nonZeroBalances = getVaultBalances(vaultGroups[0]?.vaults).filter(vb => vb);
      setZeroVaultBalance(nonZeroBalances.length === 0);
    }
  }, [balancesIsLoading, vaultGroupsIsLoading, vaultGroups]);

  const [claimState, setClaimState] = useState(EMPTY_CLAIM_STATE);
  const [zeroVaultBalance, setZeroVaultBalance] = useState(false);

  const claimAmountHandler = (contract: string, value: BigNumber, isEarly: boolean) => {
    setClaimState({
      claimSubvaultAddress: contract,
      // TODO: Update with the actual amount, because I don't want to withdraw everything because I can't re-deposit
      claimAmount: formatBigNumber(BigNumber.from('1000000000000000000')),
      isEarly,
    });
  };

  const [
    { allowance: earlyWithdrawAllowance, isLoading: earlyWithdrawAllowanceIsLoading },
    increaseEarlyWithdrawAllowance,
  ] = useTokenContractAllowance(
    { address: claimState.claimSubvaultAddress, name: 'vault ERC20' },
    env.contracts.vaultEarlyExit
  );

  const buttonIsDisabled =
    (claimState.isEarly && (earlyWithdrawIsLoading || !claimState.claimAmount)) ||
    (!claimState.isEarly && (withdrawIsLoading || !claimState.claimAmount));

  const clearClaimState = () => {
    setClaimState(EMPTY_CLAIM_STATE);
  };

  const formatErrorMessage = (errorMessage: string) => {
    const boundary = errorMessage.indexOf('(');
    if (boundary > 0) {
      return errorMessage.substring(0, boundary - 1);
    }
    return errorMessage.substring(0, 20).concat('...');
  };

  const emptyBalance = (inputBalance: VaultBalance) => {
    return !inputBalance.balance || inputBalance.balance?.lte(ZERO);
  };

  const getVaultBalances = (vaults: Vault[] | undefined) => {
    if (!vaults) return [];
    return vaults.map((vault) => {
      const vaultGroupBalances = balances[vaultGroups[0].id];
      const vaultBalance = vaultGroupBalances[vault.id] || {};
      const unlockValue = isDate(vault.unlockDate) ? format(vault.unlockDate as Date, 'MMM do') : 'now';
      const isEarly = unlockValue !== 'now';

      if (emptyBalance(vaultBalance)) {
        // empty balance should not render
        return;
      }

      return (
        <SubvaultRow key={vault.id}>
          <SubvaultCell>Subvault {vault.label}</SubvaultCell>
          <SubvaultCell>
            <ClaimAmount onClick={() => claimAmountHandler(vault.id, vaultBalance.balance || ZERO, isEarly)}>
              Claim {formatTemple(vaultBalance.balance)} $T
            </ClaimAmount>
          </SubvaultCell>
        </SubvaultRow>
      );
    });
  };

  return (
    <>
      <Popover isOpen={isOpen} onClose={onClose} closeOnClickOutside showCloseButton>
        <ClaimContainer>
          <ClaimTitle>Claim from vaults</ClaimTitle>
          {zeroVaultBalance ? (
            <ClaimSubtitle>Nothing to claim.</ClaimSubtitle>
          ) : (
            <>
              <ClaimSubtitle>Select a subvault to claim:</ClaimSubtitle>
              <SubvaultContainer>{getVaultBalances(assumedActiveVaultGroup?.vaults)}</SubvaultContainer>
            </>
          )}
          <TempleAmountContainer>
            <Temple>$TEMPLE</Temple>
            <TempleAmount>{claimState.claimAmount ? claimState.claimAmount : '0.00'}</TempleAmount>
          </TempleAmountContainer>
          {!!withdrawError && (
            <ErrorLabel>{formatErrorMessage(withdrawError.message) || 'Something went wrong'}</ErrorLabel>
          )}
          {!!earlyWithdrawError && (
            <ErrorLabel>{formatErrorMessage(earlyWithdrawError.message) || 'Something went wrong'}</ErrorLabel>
          )}
          {earlyWithdrawAllowance !== 0 && (
            <ClaimButton
              label={'Claim'}
              disabled={buttonIsDisabled}
              onClick={async () => {
                if (claimState.isEarly) {
                  await earlyWithdraw(claimState.claimSubvaultAddress, claimState.claimAmount);
                } else {
                  await withdrawFromVault(claimState.claimSubvaultAddress, claimState.claimAmount);
                }
              }}
            />
          )}
          {earlyWithdrawAllowance === 0 && (
            <ClaimButton
              label={'Approve'}
              marginTop={withdrawError ? '0.5rem' : '3.5rem'}
              disabled={earlyWithdrawAllowanceIsLoading}
              onClick={async () => {
                await increaseEarlyWithdrawAllowance();
              }}
            />
          )}
        </ClaimContainer>
      </Popover>
    </>
  );
};

const ErrorLabel = styled.span`
  color: ${({ theme }) => theme.palette.enclave.chaos};
  display: block;
  margin: 1rem 0;
`;

const ClaimAmount = styled.div`
  text-decoration: underline;
  color: #bd7b4f;
  font-weight: bold;
  cursor: pointer;
`;

const SubvaultCell = styled.div`
  color: #bd7b4f;
  padding: 5px;
`;

const SubvaultRow = styled.div`
  display: flex;
  flex-direction: row;
  margin-top: 5px;
`;

const SubvaultContainer = styled.div`
  display: flex;
  flex-direction: column;
  margin-top: 10px;
`;

const ClaimButton = styled(VaultButton)`
  width: 100px;
  height: 60px;
  background: linear-gradient(180deg, #353535 45.25%, #101010 87.55%);
  border: 1px solid #95613f;
  box-shadow: 0px 0px 20px rgba(222, 92, 6, 0.4);
  border-radius: 0.75rem;
  font-weight: 700;
  font-size: 1rem;
  letter-spacing: 0.1rem;
  text-transform: uppercase;
  color: #ffdec9;
  margin: auto;
`;

const TempleAmount = styled.div`
  font-size: 36px;
  display: flex;
  align-items: center;
  text-align: right;
  color: #ffdec9;
  padding: 20px;
`;

const Temple = styled.div`
  font-style: normal;
  font-size: 36px;
  display: flex;
  letter-spacing: 0.05em;
  color: #ffdec9;
  margin-right: auto;
`;

const ClaimSubtitle = styled.div`
  font-style: normal;
  font-weight: 700;
  font-size: 16px;
  line-height: 20px;
  align-items: center;
  letter-spacing: 0.1em;
  color: #bd7b4f;
`;

const ClaimTitle = styled.div`
  font-size: 24px;
  line-height: 28px;
  display: flex;
  align-items: center;
  color: #bd7b4f;
  padding-bottom: 20px;
`;

const TempleAmountContainer = styled.div`
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  align-items: center;
  margin-top: 20px;
  margin-bottom: 20px;
`;

const ClaimContainer = styled.div`
  display: flex;
  flex-direction: column;
`;

export default ClaimModal;
