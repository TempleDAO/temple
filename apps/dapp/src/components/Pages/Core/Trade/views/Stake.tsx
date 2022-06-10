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
import { getBigNumberFromString, formatBigNumber } from 'components/Vault/utils';
import { ZERO } from 'utils/bigNumber';
import { formatNumber } from 'utils/formatter';

import { 
  Header,
  CtaButton,
} from '../styles';

export const Stake = () => {
  const { balance } = useWallet();
  const [_, refreshWallet] = useRefreshWalletState();
  const treasuryMetrics = useRefreshableTreasuryMetrics();
  const [stakeAmount, setStakeAmount] = useState<string>('');
  const [stake, { isLoading: stakeLoading }] = useStakeTemple(() => {
    refreshWallet();
    setStakeAmount('');
  });
  
  const onChange = (amount: string) => {
    const numberAmount = Number(amount);
    if (numberAmount === 0) {
      setStakeAmount('');
    } else {
      setStakeAmount(amount);
    }
  };

  const numberStakeAmount = getBigNumberFromString(stakeAmount || '0');

  return (
    <div>
      <Header>
        <span>Stake {TICKER_SYMBOL.TEMPLE_TOKEN}</span>
        <span>{formatNumber(treasuryMetrics?.templeApy || 0)}% APY</span>
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
          onHintClick={() => setStakeAmount(`${balance.temple}`)}
          min={0}
          hint={`Balance: ${formatNumber(formatBigNumber(balance.temple))}`}
        />
      </InputWrapper>
      <CtaButton
        disabled={!stakeAmount || numberStakeAmount.gt(balance.temple) || stakeLoading}
        onClick={() => stake(stakeAmount)}
      >
        {stakeLoading ? <Loader /> : `Stake $Temple`}
      </CtaButton>
    </div>
  );
};

const InputWrapper = styled.div`
  margin-bottom: 1rem;
`;
