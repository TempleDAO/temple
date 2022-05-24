import { useState } from 'react';
import styled from 'styled-components';

import { useWallet } from 'providers/WalletProvider';
import { Input } from 'components/Input/Input';
import { TICKER_SYMBOL } from 'enums/ticker-symbol';
import { formatNumberWithCommas } from 'utils/formatter';
import { useStakeTemple } from 'hooks/core/use-stake-temple';
import { useRefreshWalletState } from 'hooks/use-refresh-wallet-state';
import useRefreshableTreasuryMetrics from 'hooks/use-refreshable-treasury-metrics';
import Loader from 'components/Loader/Loader';
import { formatNumber } from 'utils/formatter';

import { 
  Header,
  CtaButton,
} from '../styles';

export const Stake = () => {
  const { balance } = useWallet();
  const [_, refreshWallet] = useRefreshWalletState();
  const treasuryMetrics = useRefreshableTreasuryMetrics();
  const [stakeAmount, setStakeAmount] = useState<string | number>('');
  const [stake, { isLoading: stakeLoading }] = useStakeTemple(() => {
    refreshWallet();
    setStakeAmount('');
  });
  
  const onChange = (amount: string) => {
    const numberAmount = Number(amount);
    if (numberAmount === 0) {
      setStakeAmount('');
    } else {
      setStakeAmount(numberAmount);
    }
  };

  return (
    <div>
      <Header>
        <span>Stake</span>
        <span>{formatNumber(treasuryMetrics?.templeApy || 0)}% apy</span>
      </Header>
      <InputWrapper>
        <Input
          crypto={{
            kind: 'value',
            value: TICKER_SYMBOL.TEMPLE_TOKEN,
          }}
          handleChange={onChange}
          isNumber
          value={stakeAmount}
          placeholder="0"
          onHintClick={() => setStakeAmount(balance.temple)}
          min={0}
          hint={`Balance: ${formatNumberWithCommas(balance.temple)}`}
        />
      </InputWrapper>
      <CtaButton
        disabled={!stakeAmount || stakeAmount > balance.temple || stakeLoading}
        onClick={() => stake(Number(stakeAmount))}
      >
        {stakeLoading ? <Loader /> : `Stake $Temple`}
      </CtaButton>
    </div>
  );
};

const InputWrapper = styled.div`
  margin-bottom: 1rem;
`;
