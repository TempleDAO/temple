import { useState } from 'react';
import styled from 'styled-components';

import { useStaking } from 'providers/StakingProvider';
import { useWallet } from 'providers/WalletProvider';
import { Input } from 'components/Input/Input';
import { TICKER_SYMBOL } from 'enums/ticker-symbol';
import { formatNumberWithCommas } from 'utils/formatter';
import { useUnstakeOGTemple } from 'hooks/core/use-unstake-ogtemple';
import { useRefreshWalletState } from 'hooks/use-refresh-wallet-state';
import Loader from 'components/Loader/Loader';

import { 
  Header,
  CtaButton,
} from '../styles';

export const Unstake = () => {
  const { balance } = useWallet();
  const [_, refreshWallet] = useRefreshWalletState();
  const {
    exitQueueData,
    claimAvailableTemple,
  } = useStaking();
  const [unstakeAmount, setUnstakeAmount] = useState<string | number>('');
  const [unstake, { isLoading: unstakeLoading }] = useUnstakeOGTemple(() => {
    refreshWallet();
    setUnstakeAmount('');
  });
  
  const onChange = (amount: string) => {
    const numberAmount = Number(amount);
    if (numberAmount === 0) {
      setUnstakeAmount('');
    } else {
      setUnstakeAmount(numberAmount);
    }
  };

  return (
    <div>
      <Header>Unstake OGTemple</Header>
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
          onHintClick={() => setUnstakeAmount(balance.ogTemple)}
          min={0}
          hint={`Balance: ${formatNumberWithCommas(balance.ogTemple)}`}
        />
      </InputWrapper>
      <CtaButton
        disabled={unstakeLoading || !unstakeAmount || balance.ogTemple <= 0}
        onClick={() => unstake(unstakeAmount)}
      >
        Unstake
      </CtaButton>
      <Header>Withdraw</Header>
      <InputWrapper>
        <Input
          crypto={{
            kind: 'value',
            value: TICKER_SYMBOL.TEMPLE_TOKEN,
          }}
          isNumber
          disabled
          value={exitQueueData.claimableTemple}
          min={0}
        />
      </InputWrapper>
      <CtaButton
        disabled={exitQueueData.claimableTemple <= 0 || unstakeLoading}
        onClick={() => claimAvailableTemple()}
      >
        {unstakeLoading ? <Loader /> : `Withdraw ${exitQueueData.claimableTemple > 0 ? `${exitQueueData.claimableTemple} Temple` : ''}`}
      </CtaButton>
    </div>
  );
};

const InputWrapper = styled.div`
  margin-bottom: 1rem;
`;
