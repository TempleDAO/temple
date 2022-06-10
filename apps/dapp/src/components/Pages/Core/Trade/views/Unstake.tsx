import { useState } from 'react';
import styled from 'styled-components';

import { useWallet } from 'providers/WalletProvider';
import { Input } from 'components/Input/Input';
import { TICKER_SYMBOL } from 'enums/ticker-symbol';
import { useUnstakeOGTemple } from 'hooks/core/use-unstake-ogtemple';
import { useRefreshWalletState } from 'hooks/use-refresh-wallet-state';
import { getBigNumberFromString, formatBigNumber } from 'components/Vault/utils';
import { ZERO } from 'utils/bigNumber';
import { formatNumber } from 'utils/formatter';

import { Header, CtaButton } from '../styles';

export const Unstake = () => {
  const { balance } = useWallet();
  const [_, refreshWallet] = useRefreshWalletState();
  const [unstakeAmount, setUnstakeAmount] = useState<string>('');
  const [unstake, { isLoading: unstakeLoading }] = useUnstakeOGTemple(() => {
    refreshWallet();
    setUnstakeAmount('');
  });

  const onChange = (amount: string) => {
    const numberAmount = Number(amount);
    if (numberAmount === 0) {
      setUnstakeAmount('');
    } else {
      setUnstakeAmount(amount);
    }
  };

  const bigAmount = getBigNumberFromString(unstakeAmount || '0');
  const buttonIsDisabled = unstakeLoading || !unstakeAmount || balance.ogTemple.lte(ZERO)|| bigAmount.gt(balance.ogTemple);

  return (
    <>
      <Header>Unstake {TICKER_SYMBOL.OG_TEMPLE_TOKEN}</Header>
      <InputWrapper>
        <Input
          crypto={{
            kind: 'value',
            value: TICKER_SYMBOL.OG_TEMPLE_TOKEN,
          }}
          handleChange={onChange}
          isNumber
          value={unstakeAmount}
          placeholder="0"
          onHintClick={() => setUnstakeAmount(`${balance.ogTemple}`)}
          min={0}
          hint={`Balance: ${formatNumber(formatBigNumber(balance.ogTemple))}`}
        />
      </InputWrapper>
      <CtaButton
        disabled={buttonIsDisabled}
        onClick={() => unstake(unstakeAmount)}
      >
        Unstake {TICKER_SYMBOL.OG_TEMPLE_TOKEN}
      </CtaButton>
    </>
  );
};

const InputWrapper = styled.div`
  margin-bottom: 1rem;
`;
