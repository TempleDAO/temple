import { useState } from 'react';
import styled from 'styled-components';

import { VaultButton as BaseVaultButton } from '../../VaultPages/VaultContent';
import { useStaking } from 'providers/StakingProvider';
import { useWallet } from 'providers/WalletProvider';
import { Input } from 'components/Input/Input';
import { TICKER_SYMBOL } from 'enums/ticker-symbol';
import { formatNumberWithCommas } from 'utils/formatter';
import { useUnstakeOGTemple } from 'hooks/core/use-unstake-ogtemple';
import { useRefreshWalletState } from 'hooks/use-refresh-wallet-state';

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
      <VaultButton
        disabled={unstakeLoading || !unstakeAmount || balance.ogTemple <= 0}
        onClick={() => unstake(unstakeAmount)}
      >
        Unstake
      </VaultButton>
      <Header>Withdraw Temple</Header>
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
      <VaultButton
        disabled={exitQueueData.claimableTemple <= 0}
        onClick={() => claimAvailableTemple()}
      >
        Withdraw {exitQueueData.claimableTemple > 0 ? `${exitQueueData.claimableTemple} Temple` : ''}
      </VaultButton>
    </div>
  );
};

const InputWrapper = styled.div`
  margin-bottom: 1rem;
`;

const VaultButton = styled(BaseVaultButton)`
  margin: 0 auto;
`;

const Header = styled.h3`
  margin-bottom: 1rem;
`;