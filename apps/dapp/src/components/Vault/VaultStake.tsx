import { Option } from 'components/InputSelect/InputSelect';
import { VaultButton } from 'components/Vault/VaultContent';
import { TICKER_SYMBOL } from 'enums/ticker-symbol';
import { useState, useEffect } from 'react';
import styled from 'styled-components';
import { formatNumber } from 'utils/formatter';
import { Header } from 'styles/vault';
import { theme } from 'styles/theme';
import { VaultInput } from 'components/Input/VaultInput';
import { CryptoSelect } from 'components/Input/CryptoSelect';

// This dummy data will be replaced by the actual contracts
const dummyOptions = [
  { value: '$FRAX', label: '$FRAX' },
  { value: '$TEMPLE', label: '$TEMPLE' },
  { value: '$OGTEMPLE', label: '$OGTEMPLE' },
  { value: '$FAITH', label: '$FAITH' },
  { value: '$ETH', label: '$ETH' },
  { value: '$USDC', label: '$USDC' },
  { value: '$FEI', label: '$FEI' },
];

// This dummy data will be replaced by the actual contracts
const dummyWalletBalances = {
  $FRAX: 4834,
  $TEMPLE: 12834,
  $OGTEMPLE: 41834,
  $FAITH: 3954,
  $ETH: 12,
  $USDC: 402,
  $FEI: 945,
};

// This dummy data will be replaced by the actual contracts
const dummyCurrencyToTemple = {
  $FRAX: 423,
  $TEMPLE: 343334,
  $OGTEMPLE: 502933,
  $FAITH: 554,
  $ETH: 14454,
  $USDC: 49233,
  $FEI: 9293,
};

const defaultOption = { value: '$FRAX', label: '$FRAX' };

const VaultClaim = () => {
  const [stakingAmount, setStakingAmount] = useState<number | ''>('');
  const [templeAmount, setTempleAmount] = useState<number | ''>('');
  const [ticker, setTicker] = useState(dummyOptions[0].value);

  const [walletCurrencyBalance, setWalletCurrencyBalance] = useState<number>(0);

  const handleTickerUpdate = (val: Option) => {
    setTicker(val.value as string);
    setWalletCurrencyBalance(
      dummyWalletBalances[
        val.value as keyof typeof dummyWalletBalances
      ] as number
    );
    setStakingAmount('');
    setTempleAmount('');
  };

  const handleUpdateStakingAmount = async (value: number) => {
    setStakingAmount(value === 0 ? '' : value);
    conditionallySetTempleAmount();
  };

  const handleHintClick = () => {
    handleUpdateStakingAmount(walletCurrencyBalance);
  };

  const conditionallySetTempleAmount = () => {
    if (ticker === '$TEMPLE') {
      setTempleAmount('');
      return;
    }
    setTempleAmount(
      dummyCurrencyToTemple[ticker as keyof typeof dummyCurrencyToTemple]
    );
  };

  useEffect(() => {
    handleTickerUpdate(defaultOption);
  }, []);

  return (
    <>
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
      <AmountInTemple>
        {templeAmount !== ''
          ? `Staking ${templeAmount} ${TICKER_SYMBOL.TEMPLE_TOKEN}`
          : ''}{' '}
        {'\u00A0'}
      </AmountInTemple>
      <VaultButton label={'stake'} autoWidth />
    </>
  );
};

const SelectContainer = styled.div`
  margin: 0 auto;
  width: 50%;
  padding: 1rem;
  display: inline-block;
  z-index: 4;
`;

const AmountInTemple = styled.p`
  color: ${theme.palette.brandLight};
`;

const DepositContainer = styled.div`
  color: ${theme.palette.brandLight};
  font-size: 1.5rem;
  padding: 1.4rem 0 1.8rem;
  display: inline-block;
`;

export default VaultClaim;
