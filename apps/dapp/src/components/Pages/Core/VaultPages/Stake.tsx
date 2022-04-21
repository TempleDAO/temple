import { useState, useEffect, ReactNode } from 'react';
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
import { toAtto } from 'utils/bigNumber';
import EllipsisLoader from 'components/EllipsisLoader';

// This dummy data will be replaced by the actual contracts
const dummyOptions = [
  { value: '$TEMPLE', label: 'TEMPLE' },
  { value: '$OGTEMPLE', label: 'OGTEMPLE' },
  { value: 'FAITH', label: 'FAITH' },
  { value: '$FRAX', label: 'FRAX' },
  { value: '$ETH', label: 'ETH' },
  { value: '$USDC', label: 'USDC' },
  { value: '$FEI', label: 'FEI' },
];

// This dummy data will be replaced by the actual contracts
const dummyWalletBalances = {
  $FRAX: 4834,
  $TEMPLE: 12834,
  $OGTEMPLE: 41834,
  FAITH: 3954,
  $ETH: 12,
  $USDC: 402,
  $FEI: 945,
};

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

const defaultOption = { value: '$TEMPLE', label: 'TEMPLE' };

const useStakeAssetRequest = (token: TICKER_SYMBOL, amount: BigNumber) => {
  const stakeAssetRequest = createMockRequest({ success: true }, 1000, true);
  return useRequestState(() => stakeAssetRequest(token, amount));
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
  const [stakingAmount, setStakingAmount] = useState<number | ''>('');
  const [ticker, setTicker] = useState<TICKER_SYMBOL>(
    dummyOptions[0].value as TICKER_SYMBOL
  );
  const [walletCurrencyBalance, setWalletCurrencyBalance] = useState<number>(0);

  const [stakeAssetsRequest, { isLoading: stakeLoading, error: stakeError }] =
    useStakeAssetRequest(ticker, toAtto(!stakingAmount ? 0 : stakingAmount));

  const [
    zapAssetRequest,
    { response: zapRepsonse, error: zapError, isLoading: zapLoading },
  ] = useZappedAssetTempleBalance(
    ticker,
    toAtto(!stakingAmount ? 0 : stakingAmount)
  );

  const handleTickerUpdate = (val: Option) => {
    setTicker(val.value as TICKER_SYMBOL);
    setWalletCurrencyBalance(
      dummyWalletBalances[
        val.value as keyof typeof dummyWalletBalances
      ] as number
    );
    setStakingAmount('');
  };

  const handleUpdateStakingAmount = (value: number) => {
    setStakingAmount(value === 0 ? '' : value);

    // If there is a value present and its not TEMPLE request the zapped value.
    if (ticker !== TICKER_SYMBOL.TEMPLE_TOKEN && !!value) {
      zapAssetRequest();
    }
  };

  const handleHintClick = () => {
    handleUpdateStakingAmount(walletCurrencyBalance);
  };

  useEffect(() => {
    handleTickerUpdate(defaultOption);
  }, []);

  const isZap = ticker !== TICKER_SYMBOL.TEMPLE_TOKEN;
  const templeAmount = !isZap
    ? stakingAmount
    : (stakingAmount && zapRepsonse?.templeAmount) || 0;
  const stakeButtonDisabled =
    !templeAmount || stakeLoading || zapLoading || (isZap && !!zapError);

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

  return (
    <VaultContent>
      <Header>Stake</Header>
      <DepositContainer>
        DEPOSIT{' '}
        <SelectContainer>
          <CryptoSelect
            options={dummyOptions}
            defaultValue={defaultOption}
            onChange={handleTickerUpdate}
          />
        </SelectContainer>
      </DepositContainer>
      <VaultInput
        tickerSymbol={ticker}
        handleChange={handleUpdateStakingAmount}
        hint={`Balance: ${formatNumber(walletCurrencyBalance)}`}
        onHintClick={handleHintClick}
        isNumber
        placeholder={'0.00'}
        value={stakingAmount}
      />
      <AmountInTemple>{isZap && templeAmountMessage}</AmountInTemple>
      {!!stakeError && (
        <ErrorLabel>{stakeError.message || 'Something went wrong'}</ErrorLabel>
      )}

      <VaultButton
        label={'stake'}
        autoWidth
        disabled={stakeButtonDisabled}
        onClick={async () => {
          try {
            return stakeAssetsRequest();
          } catch (error) {
            // intentionally empty, handled in hook
          }
        }}
      />
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
  margin: 0 0 1rem;
`;

const DepositContainer = styled.div`
  color: ${theme.palette.brandLight};
  font-size: 1.5rem;
  padding: 1.5rem 0 1.2rem;
  display: inline-block;
`;
