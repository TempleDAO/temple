import { useMemo, useState } from 'react';
import { BigNumber } from 'ethers';

import { useWallet } from 'providers/WalletProvider';
import { formatNumber, formatNumberFixedDecimals } from 'utils/formatter';
import { Pool } from 'components/Layouts/Ascend/types';
import { Input } from 'components/Input/Input';
import { TransactionSettingsModal } from 'components/TransactionSettingsModal/TransactionSettingsModal';
import { useTokenContractAllowance } from 'hooks/core/use-token-contract-allowance';
import { CircularLoader as BaseCircularLoader, CircularLoader } from 'components/Loader/CircularLoader';
import { DBN_ZERO, DecimalBigNumber } from 'utils/DecimalBigNumber';

import { useVaultTradeState } from './hooks/use-vault-trade-state';
import { useAuctionContext } from '../AuctionContext';

import {
  Wrapper,
  TradeHeader,
  SwapControls,
  ToggleButton,
  LoadWrapper,
  ReceivedValues,
  SlippageButton,
  SwapButton,
  ErrorMessage,
  ZapFromVaultWrapper,
} from './styles';

import { AnalyticsService } from 'services/AnalyticsService';
import { AnalyticsEvent } from 'constants/events';
import { Link } from 'react-router-dom';
import styled from 'styled-components';
import { CryptoSelect, Option } from 'components/Input/CryptoSelect';

interface Props {
  pool: Pool;
}

export const Trade = ({ pool }: Props) => {
  const { wallet } = useWallet();
  const {
    swapState: { buy, sell },
    toggleTokenPair,
    resetTokenPairToDefault,
    vaultAddress,
    userBalances,
    isPaused,
  } = useAuctionContext();
  const [transactionSettingsOpen, setTransactionSettingsOpen] = useState(false);

  const {
    swap,
    state,
    setSellValue,
    setTransactionSettings,
    zap: { options: zapOptions, balances: zapBalances },
    depositFromVault,
    setDepositFromVault,
  } = useVaultTradeState(
    pool,
    async (tokenSold, tokenBought, amount, poolId) => {
      AnalyticsService.captureEvent(AnalyticsEvent.Ascend.Swap, {
        tokenSold,
        tokenBought,
        amount,
        poolId,
      });
    }
  );

  const [{ allowance, isLoading: allowanceIsLoading }, increaseAllowance] = useTokenContractAllowance(
    sell,
    vaultAddress
  );

  const [{ allowance: ascendZapAllowance, isLoading: ascendZapAllowanceIsLoading }, increaseAscendZapAllowance] =
    useTokenContractAllowance(
      sell,
      '0x1234' // TODO: Update this address to the zap contract
    );


  const bigSellAmount = useMemo(() => {
    if (!state.inputValue || state.inputValue.trim() === '.') {
      return DBN_ZERO;
    }
    return DecimalBigNumber.parseUnits(state.inputValue, sell.decimals);
  }, [sell, state.inputValue]);

  const { receiveEstimate, estimateWithSlippage } = useMemo(() => {
    if (!state.quote.estimate) {
      return { receiveEstimate: '', estimateWithSlippage: '' };
    }

    return {
      receiveEstimate: state.quote.estimate.formatUnits(),
      estimateWithSlippage: state.quote.estimateWithSlippage!.formatUnits(),
    };
  }, [state.quote, buy]);

  const sellBalance = userBalances[sell.address] || DBN_ZERO;
  const buyBalance = userBalances[buy.address] || DBN_ZERO;

  const [selectedSellBalance, setSelectedSellBalance] = useState(sellBalance);

  if (!wallet) {
    return (
      <Wrapper verticalAlignment="top">
        <h3>Connect Wallet</h3>
        <p>Please connect your wallet...</p>
      </Wrapper>
    );
  }

  if (!pool.swapEnabled || isPaused) {
    return (
      <Wrapper verticalAlignment="top">
        <h3>Paused!</h3>
        <p>This event is currently paused.</p>
      </Wrapper>
    );
  }

  const handleWalletVaultToggle = (usingVault: boolean) => {
    resetTokenPairToDefault();
    setDepositFromVault(usingVault);
    setSelectedSellBalance(usingVault ? DBN_ZERO : sellBalance);
  };

  const onVaultSelectChange = (selected: Option) => {
    const vaultBalance = zapBalances[selected.value];
    setSelectedSellBalance(vaultBalance);
  };
  
  return (
    <>
      <TransactionSettingsModal
        isOpen={transactionSettingsOpen}
        onClose={() => setTransactionSettingsOpen(false)}
        onChange={({ slippageTolerance, deadlineMinutes }) => {
          if (slippageTolerance < 0 || slippageTolerance > 100) {
            return;
          }
          setTransactionSettings({ slippageTolerance, deadlineMinutes });
        }}
      />
      <Wrapper>
        {zapOptions.length > 0 && (
          <Menu>
            <WalletVaultLink
              $isActive={!depositFromVault}
              to="#"
              onClick={() => handleWalletVaultToggle(false)}
            >
              From Wallet
            </WalletVaultLink>
            <WalletVaultLink
              $isActive={depositFromVault}
              to="#"
              onClick={() => handleWalletVaultToggle(true)}
            >
              From Vault
            </WalletVaultLink>
          </Menu>
        )}
        <TradeHeader>
          Trade {sell.symbol}
        </TradeHeader>
        {!!depositFromVault && (
          <ZapFromVaultWrapper>
            <CryptoSelect
              name="vault-select"
              onChange={onVaultSelectChange}
              options={zapOptions}
            />
          </ZapFromVaultWrapper>
        )}
        <Input
          isNumber
          crypto={{ kind: 'value', value: sell.symbol }}
          placeholder="0.00"
          small
          value={state.inputValue}
          hint={`Balance: ${formatNumber(selectedSellBalance.formatUnits())}`}
          onHintClick={() => {
            setSellValue(selectedSellBalance.formatUnits());
          }}
          handleChange={(value) => {
            const stringValue = value.toString();
            if (!stringValue.startsWith('.') && Number(stringValue) === 0) {
              setSellValue('');
            } else {
              setSellValue(stringValue);
            }
          }}
        />
        <ToggleButton
          type="button"
          onClick={() => toggleTokenPair()}
          aria-label="Toggle Inputs"
          hoverDisabled={depositFromVault}
          disabled={state.quote.isLoading || depositFromVault}
        />
        <Input
          isNumber
          placeholder="0.00"
          crypto={{ kind: 'value', value: buy.symbol }}
          small
          value={receiveEstimate}
          hint={`Balance: ${formatNumber(buyBalance.formatUnits())}`}
          disabled
        />
        <SwapControls>
          {state.quote.isLoading && (
            <LoadWrapper>
              <BaseCircularLoader />
            </LoadWrapper>
          )}
          <ReceivedValues>
            {!!receiveEstimate && !state.quote.isLoading && (
              <>
                Expected Output: {formatNumberFixedDecimals(receiveEstimate, 3)}
                <br />
                Minimum Amount: {formatNumberFixedDecimals(estimateWithSlippage, 3)}
              </>
            )}
            {state.quote.isLoading && <>Fetching Price...</>}
          </ReceivedValues>
          <SlippageButton type="button" onClick={() => setTransactionSettingsOpen(true)}>
            {state.transactionSettings.slippageTolerance}%
          </SlippageButton>
        </SwapControls>
        {allowance === 0 && !depositFromVault && (
          <SwapButton
            type="button"
            disabled={allowanceIsLoading || state.swap.isLoading}
            onClick={() => {
              increaseAllowance();
            }}
          >
            {allowanceIsLoading ? <CircularLoader /> : <>Approve</>}
          </SwapButton>
        )}
        {allowance !== 0 && !depositFromVault && (
          <SwapButton
            type="button"
            disabled={
              bigSellAmount.isZero() ||
              bigSellAmount.gt(selectedSellBalance) ||
              state.quote.isLoading ||
              !state.quote.estimate ||
              state.swap.isLoading
            }
            onClick={() => {
              swap();
            }}
          >
            {state.swap.isLoading ? <CircularLoader /> : <>Swap</>}
          </SwapButton>
        )}
        {ascendZapAllowance === 0 && depositFromVault && (
          <SwapButton
            type="button"
            disabled={ascendZapAllowanceIsLoading || state.swap.isLoading}
            onClick={() => {
              increaseAscendZapAllowance();
            }}
          >
            {ascendZapAllowanceIsLoading ? <CircularLoader /> : <>Approve</>}
          </SwapButton>
        )}
        {ascendZapAllowance !== 0 && depositFromVault && (
          <SwapButton
            type="button"
            disabled={
              bigSellAmount.isZero() ||
              bigSellAmount.gt(selectedSellBalance) ||
              state.quote.isLoading ||
              !state.quote.estimate ||
              state.swap.isLoading
            }
            onClick={() => {
              swap();
            }}
          >
            {state.swap.isLoading ? <CircularLoader /> : <>Swap</>}
          </SwapButton>
        )}

        {!!state.swap.error && <ErrorMessage>{state.swap.error}</ErrorMessage>}
        {!!state.quote.error && <ErrorMessage>{state.quote.error}</ErrorMessage>}
      </Wrapper>
    </>
  );
};

const WalletVaultLink = styled(Link)<{ $isActive: boolean }>`
  padding: 0.5rem 1rem;
  border-radius: 0.5rem;
  display: block;
  background: ${({ $isActive }) => ($isActive ? '#1D1A1A' : 'transparent')};
  transition: all ease-out 200ms;
`;

const MenuWrapper = styled.div`
  display: flex;
  flex-direction: row;
  align-items: center;
  width: 100%;
  justify-content: space-between;
`;

const Menu = styled.div`
  display: flex;
  flex-direction: row;
  align-items: center;
`;
