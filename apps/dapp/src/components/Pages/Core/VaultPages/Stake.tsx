import { useState, ReactNode } from 'react';
import styled from 'styled-components';
import { BigNumber } from 'ethers';

import { Option } from 'components/InputSelect/InputSelect';
import VaultContent, {
  VaultButton,
} from 'components/Pages/Core/VaultPages/VaultContent';
import { TICKER_SYMBOL } from 'enums/ticker-symbol';
import { formatNumber } from 'utils/formatter';
import { Header } from 'styles/vault';
import { theme } from 'styles/theme';
import { VaultInput } from 'components/Input/VaultInput';
import { CryptoSelect } from 'components/Input/CryptoSelect';
import useRequestState, { createMockRequest } from 'hooks/use-request-state';
import EllipsisLoader from 'components/EllipsisLoader';
import { useRefreshWalletState } from 'hooks/use-refresh-wallet-state';
import { useDepositToVault } from 'hooks/core/use-deposit-to-vault';
import { useVaultContext } from 'components/Pages/Core/VaultContext';
import { useWallet } from 'providers/WalletProvider';
import { toAtto } from 'utils/bigNumber';
import { MetaMaskError } from 'hooks/core/types';
import { useTokenVaultAllowance } from 'hooks/core/use-token-vault-allowance'
import { useVaultBalance } from 'hooks/core/use-vault-balance';

// This dummy data will be replaced by the actual contracts
const OPTIONS = [
  { value: '$TEMPLE', label: 'TEMPLE' },
  { value: '$OGTEMPLE', label: 'OGTEMPLE' },
  { value: 'FAITH', label: 'FAITH' },
  { value: '$FRAX', label: 'FRAX' },
  { value: '$ETH', label: 'ETH' },
  { value: '$USDC', label: 'USDC' },
  { value: '$FEI', label: 'FEI' },
];

// This dummy data will be replaced by the actual contracts
const dummyCurrencyToTemple: Record<TICKER_SYMBOL, number> = {
  $FRAX: 423,
  $TEMPLE: 343334,
  $OGTEMPLE: 502933,
  FAITH: 554,
  $ETH: 14454,
  $USDC: 49233,
  $FEI: 9293,
};

const useZappedAssetTempleBalance = (
  token: TICKER_SYMBOL,
  amount: BigNumber
) => {
  const zapAssetRequest = createMockRequest(
    { templeAmount: dummyCurrencyToTemple[token] },
    1000,
    true
  );
  return useRequestState(() => zapAssetRequest(token, amount));
};

export const Stake = () => {
  const { activeVault: vault } = useVaultContext();
  const { balance, isConnected } = useWallet();

   // UI amount to stake
   const [stakingAmount, setStakingAmount] = useState<string | number>('');

  // Currently selected token
  const [ticker, setTicker] = useState<TICKER_SYMBOL>(
    OPTIONS[0].value as TICKER_SYMBOL
  );

  const [_, refreshBalance] = useVaultBalance(vault.id);
  const [{ isLoading: refreshIsLoading }, refreshWalletState] = useRefreshWalletState();
  const [deposit, { isLoading: depositLoading, error: depositError }] = useDepositToVault(vault.id, async () => {
    refreshBalance();
    refreshWalletState();
  });
  
  const [{ allowance, isLoading: allowanceLoading }, increaseAllowance] = useTokenVaultAllowance(vault.id, ticker);

  const [
    zapAssetRequest,
    { response: zapRepsonse, error: zapError, isLoading: zapLoading },
  ] = useZappedAssetTempleBalance(
    ticker,
    toAtto(Number(stakingAmount || 0))
  );

  const handleUpdateStakingAmount = (value: number | string) => {
    setStakingAmount(Number(value) === 0 ? '' : value);

    // If there is a value present and its not TEMPLE request the zapped value.
    if (ticker !== TICKER_SYMBOL.TEMPLE_TOKEN && !!value) {
      zapAssetRequest();
    }
  };

  const getTokenBalanceForCurrentTicker = () => {
    switch (ticker) {
      case TICKER_SYMBOL.TEMPLE_TOKEN:
        return balance.temple;
    }
    console.error(`Programming Error: ${ticker} not implemented.`);
    return 0;
  };

  const tokenBalance = getTokenBalanceForCurrentTicker();

  const isZap = ticker !== TICKER_SYMBOL.TEMPLE_TOKEN;
  const templeAmount = !isZap
    ? stakingAmount
    : (stakingAmount && zapRepsonse?.templeAmount) || 0;
  
  const stakeButtonDisabled = (
    !isConnected ||
    refreshIsLoading || 
    !templeAmount ||
    depositLoading ||
    zapLoading || 
    allowanceLoading ||
    (isZap && !!zapError)
  );

  let templeAmountMessage: ReactNode = '';
  if (zapError) {
    templeAmountMessage = zapError.message || 'Something went wrong';
  } else if (zapLoading) {
    templeAmountMessage = (
      <>
        Staking <EllipsisLoader />
      </>
    );
  } else if (zapRepsonse && !!stakingAmount) {
    templeAmountMessage = (
      <>
        Staking {zapRepsonse.templeAmount} {TICKER_SYMBOL.TEMPLE_TOKEN}
        {' \u00A0'}
      </>
    );
  }

  const error = !!depositError && ((depositError as MetaMaskError).data?.message || depositError.message || 'Something went wrong');

  return (
    <VaultContent>
      <Header>Stake</Header>
      <DepositContainer>
        DEPOSIT{' '}
        <SelectContainer>
          <CryptoSelect
            options={OPTIONS}
            defaultValue={OPTIONS[0]}
            onChange={(val: Option) => {
              setTicker(val.value as TICKER_SYMBOL);
              handleUpdateStakingAmount(0);
            }}
          />
        </SelectContainer>
      </DepositContainer>
      <VaultInput
        tickerSymbol={ticker}
        handleChange={handleUpdateStakingAmount}
        hint={`Balance: ${formatNumber(tokenBalance)}`}
        onHintClick={() => {
          handleUpdateStakingAmount(tokenBalance);
        }}
        isNumber
        placeholder="0.00"
        value={stakingAmount}
      />
      {!!(isZap && templeAmountMessage) && <AmountInTemple>{templeAmountMessage}</AmountInTemple>}
      <ErrorLabel>{error}</ErrorLabel>
      {allowance === 0 && (
        <VaultButton
          label="Approve"
          autoWidth
          disabled={allowanceLoading}
          onClick={async () => {
            return increaseAllowance();
          }}
        />
      )}
      {allowance !== 0 && (
        <VaultButton
          label="Stake"
          autoWidth
          disabled={stakeButtonDisabled}
          loading={refreshIsLoading || depositLoading}
          onClick={async () => {
            const amountToDeposit = !stakingAmount ? 0 : stakingAmount;
            await deposit(amountToDeposit);
            setStakingAmount('');
          }}
        />
      )}
    </VaultContent>
  );
};

const SelectContainer = styled.div`
  margin: 0 auto;
  width: 50%;
  padding: 1rem;
  display: inline-block;
  z-index: 4;
`;

const AmountInTemple = styled.span`
  color: ${theme.palette.brandLight};
  display: block;
  margin: 1rem 0;
  height: 1.5rem;
`;

const ErrorLabel = styled.span`
  color: ${theme.palette.enclave.chaos};
  display: block;
  margin: 1rem;
`;

const DepositContainer = styled.div`
  color: ${theme.palette.brandLight};
  font-size: 1.5rem;
  padding: 1.5rem 0 1.2rem;
  display: inline-block;
`;
