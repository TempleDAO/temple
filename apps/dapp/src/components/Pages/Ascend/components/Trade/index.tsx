import { useMemo, useState } from 'react';

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
} from './styles';

import { AnalyticsService } from 'services/AnalyticsService';
import { AnalyticsEvent } from 'constants/events';
import { Link } from 'react-router-dom';
import styled from 'styled-components';
import { useVaultContext } from 'components/Pages/Core/VaultContext';
import { CryptoSelect, Option } from 'components/Input/CryptoSelect';
import { BigNumber } from 'ethers';

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

  const { swap, state, setSellValue, setTransactionSettings, depositFromVault, setDepositFromVault } = useVaultTradeState(
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

    // TODO: Mr Fuji's context work here
  // const { vaultGroup, balances: userVaultBalances } = useVaultContext();

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

  // TODO: Use vaultGroup instead (once vault and ascend are working locally)
  const DUMMY_VAULT_GROUP = {
    id: '1m-core',
    vaults: [
      {
        tvl: '60169272.44934053312620580799999999',
        id: '0x402832ec42305cf7123bc9903f693e944484b9c1',
        templeToken: '0x470ebf5f030ed85fc1ed4c2d36b9dd02e77cf1b7',
        symbol: '1m-core-a',
        shareBoostFactor: '1',
        name: '1m-core',
        joiningFee: '0x8a17403b929ed1b6b50ea880d9c93068a5105d4c',
      },
      {
        tvl: '12703698.57780659453956695800000001',
        id: '0xa99980c64fc6c302377c39f21431217fcbaf39af',
        templeToken: '0x470ebf5f030ed85fc1ed4c2d36b9dd02e77cf1b7',
        symbol: '1m-core-b',
        shareBoostFactor: '1',
        name: '1m-core',
        joiningFee: '0x8a17403b929ed1b6b50ea880d9c93068a5105d4c',
      },
      {
        tvl: '8846973.966842409041739599000000002',
        id: '0xb6226ad4fef850dc8b85a83bdc0d4aff9c61cd39',
        templeToken: '0x470ebf5f030ed85fc1ed4c2d36b9dd02e77cf1b7',
        symbol: '1m-core-c',
        shareBoostFactor: '1',
        name: '1m-core',
        joiningFee: '0x8a17403b929ed1b6b50ea880d9c93068a5105d4c',
      },
      {
        tvl: '4559871.647470618986171320999999998',
        id: '0xd43cc1814bd87b67b318e4807cde50c090d01c1a',
        templeToken: '0x470ebf5f030ed85fc1ed4c2d36b9dd02e77cf1b7',
        symbol: '1m-core-d',
        shareBoostFactor: '1',
        name: '1m-core',
        joiningFee: '0x8a17403b929ed1b6b50ea880d9c93068a5105d4c',
      },
    ],
  };

  // TODO: Should use use-vault-group-token-balance instead (once vault and ascend are working locally)
  // See handleVaultSelect below
  const DUMMY_USER_VAULT_BALANCES = {
    [DUMMY_VAULT_GROUP.vaults[0].id]: 10,
    [DUMMY_VAULT_GROUP.vaults[1].id]: 105,
    [DUMMY_VAULT_GROUP.vaults[2].id]: 102,
    [DUMMY_VAULT_GROUP.vaults[3].id]: 304,
  };

  const handleWalletVaultToggle = (usingVault: boolean) => {
    resetTokenPairToDefault();
    setDepositFromVault(usingVault);
    setSelectedSellBalance(usingVault ? DBN_ZERO : sellBalance);
  };

  const handleVaultSelect = (selected: Option) => {
    // TODO: Use the use-vault-group-token-balance hook here, to get token balance
    const userVaultBalance = BigNumber.from(DUMMY_USER_VAULT_BALANCES[selected.value]);
    setSelectedSellBalance(DecimalBigNumber.fromBN(userVaultBalance, 0));
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
        <Menu>
          <WalletVaultLink $isActive={!depositFromVault} to="#" onClick={() => handleWalletVaultToggle(false)}>
            From Wallet
          </WalletVaultLink>
          <WalletVaultLink $isActive={depositFromVault} to="#" onClick={() => handleWalletVaultToggle(true)}>
            From Vault
          </WalletVaultLink>
        </Menu>
        <TradeHeader>
          Trade {sell.symbol}
          {depositFromVault ? (
            <>
              {' from '}
              <CryptoSelect
                name="vault-select"
                onChange={handleVaultSelect}
                options={DUMMY_VAULT_GROUP.vaults.map((subVault) => ({ value: subVault.id, label: subVault.symbol }))}
              ></CryptoSelect>
            </>
          ) : (
            ''
          )}
        </TradeHeader>
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
