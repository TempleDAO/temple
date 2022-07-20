import { useState } from 'react';
import { BigNumber } from 'ethers';
import styled from 'styled-components';

import { formatNumber } from 'utils/formatter';
import { Pool } from 'components/Layouts/Ascend/types';
import { Input } from 'components/Input/Input';
import { ZERO } from 'utils/bigNumber';
import { buttonResets, flexCenter } from 'styles/mixins';
import { getBigNumberFromString, formatBigNumber } from 'components/Vault/utils';
import { TransactionSettingsModal } from 'components/TransactionSettingsModal/TransactionSettingsModal';
import { useTokenContractAllowance } from 'hooks/core/use-token-contract-allowance';
import { CircularLoader as BaseCircularLoader } from 'components/Loader/CircularLoader';

import {
  TradeWrapper,
  TradeHeader,
} from '../../styles';
import Loader from 'components/Loader/Loader';

import { useTradeState } from './hooks';

interface Props {
  pool: Pool;
}

export const Trade = ({ pool }: Props) => {
  const [transactionSettingsOpen, setTransactionSettingsOpen] = useState(false);
  const {
    state,
    togglePair,
    setSellValue,
    swap,
    vaultAddress: lbpVaultAddress,
    setTransactionSettings,
  } = useTradeState(pool);
  const [{ allowance, isLoading: allowanceIsLoading }, increaseAllowance] = useTokenContractAllowance(state.sell, lbpVaultAddress);

  const bigSellAmount = getBigNumberFromString(state.sell.value);

  const indexOfSell = pool.tokensList.findIndex((address) => address === state.sell.address);
  const indexOfBuy = pool.tokensList.findIndex((address) => address === state.buy.address);

  let receiveEstimate = '';
  if (state.quote.value) {
    receiveEstimate = Math.abs(Number(state.quote.value[indexOfBuy])).toString();
  } 

  return (
    <>
      <TransactionSettingsModal
        isOpen={transactionSettingsOpen}
        onClose={() => setTransactionSettingsOpen(false)}
        onChange={setTransactionSettings}
      />
      <TradeWrapper>
        <TradeHeader>Trade TEMPLE</TradeHeader>
        <Input
          isNumber
          crypto={{ kind: 'value', value: state.sell.symbol }}
          placeholder="0.00"
          value={state.sell.value}
          hint={`Balance: ${formatNumber(formatBigNumber(state.sell.balance as BigNumber))}`}
          onHintClick={() => {
            setSellValue(formatBigNumber(state.sell.balance as BigNumber));
          }}
          handleChange={(value) => {
            const stringValue = value.toString();
            if (
              !stringValue.startsWith('.') && 
              Number(stringValue) === 0
            ) {
              setSellValue('');
            } else {
              setSellValue(stringValue);
            }
          }}
        />
        <ToggleButton
          type="button"
          onClick={() => togglePair()}
          aria-label="Toggle Inputs"
          disabled={state.quote.loading}
        />
        <Input
          isNumber
          placeholder="0.00"
          crypto={{ kind: 'value', value: state.buy.symbol }}
          value={receiveEstimate}
          hint={`Balance: ${formatNumber(formatBigNumber(state.buy.balance as BigNumber))}`}
          disabled
        />
        <SwapControls>
          {state.quote.loading && (
            <LoadWrapper>
              <BaseCircularLoader />
            </LoadWrapper>
          )}
          <div>
            {state.quote.value ? (
              <>
                Receive: {Math.abs(Number(state.quote.value[indexOfBuy]))}
                For: {state.quote.value[indexOfSell]}
              </>
            ) : (
              <>
                Fetching Price...
              </>
            )}
          </div>
          <SlippageButton type="button" onClick={() => setTransactionSettingsOpen(true)}>
            1%
          </SlippageButton>
        </SwapControls>
        {allowance === 0 && (
          <SwapButton
            type="button"
            disabled={
              allowanceIsLoading
            }
            onClick={() => {
              increaseAllowance();
            }}
          >
            {allowanceIsLoading ? <Loader /> : <>Increase Allowance</>}
          </SwapButton>
        )}
        {allowance !== 0 && (
          <SwapButton
            type="button"
            disabled={
              bigSellAmount.eq(ZERO) ||
              bigSellAmount.gt(state.sell.balance) ||
              state.quote.loading
            }
            onClick={() => {
              swap();
            }}
          >
            Swap
          </SwapButton>
        )}
      </TradeWrapper>
    </>
  );
};

const LoadWrapper = styled.div`
  margin-right: 0.5rem;
  display: block;
`;

const SlippageButton = styled.button`
  ${buttonResets}

  border: 1px solid ${({ theme }) => theme.palette.brand};
  background: transparent;
  padding: 0.5rem;
  margin-right: 1rem;
  color: ${({ theme }) => theme.palette.light};
  font-weight: 700;
`;

const SwapControls = styled.div`
  display: flex;
  background-color: ${({ theme }) => theme.palette.dark};
  padding: 1rem;
  flex-direction: row;
  width: 100%;
  align-items: center;
`;

const ToggleButton = styled.button`
  ${buttonResets}

  background-color: ${({ theme }) => theme.palette.brand};
 

  width: 1.875rem;
  height: 1.875rem;
  border-radius: 50%;
  margin-top: calc(-0.2rem - 0.5625rem);
  margin-bottom: -0.5625rem;
  z-index: 50;
`;

const SwapButton = styled.button`
  ${buttonResets}
  ${flexCenter}

  border-radius: 0.625rem;
  background-color: ${({ theme }) => theme.palette.brand};
  border: 1px solid ${({ theme }) => theme.palette.brand};
  font-weight: 700;
  color: ${({ theme }) => theme.palette.light};
  display: flex;
  padding: 1.25rem 0;
  width: 100%;
  text-transform: uppercase;

  transition: all ease-in 200ms;

  &:hover {
    background-color: ${({ theme }) => theme.palette.brand75};
    border: 1px solid ${({ theme }) => theme.palette.brand75};
  }

  &:disabled {
    background-color: transparent;
    border: 1px solid ${({ theme }) => theme.palette.brand50};
    color: ${({ theme }) => theme.palette.brand50};
    cursor: not-allowed;
  }
`;