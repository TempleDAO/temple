import { useState } from 'react';
import styled from 'styled-components';
import { Button } from 'components/Button/Button';

import { useWallet } from 'providers/WalletProvider';
import { Input } from 'components/Input/Input';
import { TICKER_SYMBOL } from 'enums/ticker-symbol';
import { useUnstakeOGTemple } from 'hooks/core/use-unstake-ogtemple';
import { useRefreshWalletState } from 'hooks/use-refresh-wallet-state';
import { getBigNumberFromString, formatBigNumber } from 'components/Vault/utils';
import { ZERO } from 'utils/bigNumber';
import { formatNumber } from 'utils/formatter';
import { useAppContext } from 'providers/AppProvider';
import { Button as BaseButton } from 'components/Button/Button';
import { verySmallDesktop } from 'styles/breakpoints';
import { Popover } from 'components/Popover';

interface IProps {
  isOpen: boolean;
  onClose: () => void;
}

export const UnstakeOgtModal: React.FC<IProps> = ({ isOpen, onClose }) => {
  const { balance } = useWallet();
  const { showConnectPopover } = useAppContext();
  const [_, refreshWallet] = useRefreshWalletState();
  const [unstakeAmount, setUnstakeAmount] = useState<string>('');
  const [unstake, { isLoading: unstakeLoading }] = useUnstakeOGTemple(() => {
    refreshWallet();
    setUnstakeAmount('');
  });

  const clickConnect = () => {
    showConnectPopover();
  };

  const onChange = (amount: string) => {
    const numberAmount = Number(amount);
    if (numberAmount === 0) {
      setUnstakeAmount('');
    } else {
      setUnstakeAmount(amount);
    }
  };

  const bigAmount = getBigNumberFromString(unstakeAmount || '0');
  const buttonIsDisabled =
    unstakeLoading || !unstakeAmount || balance.ogTemple.lte(ZERO) || bigAmount.gt(balance.ogTemple);

  return (
    <Popover isOpen={isOpen} onClose={onClose} closeOnClickOutside showCloseButton>
      <UnstakeTitle>Unstake {TICKER_SYMBOL.OG_TEMPLE_TOKEN}</UnstakeTitle>
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
          onHintClick={() => {
            const amount = balance.ogTemple.eq(ZERO) ? '' : formatBigNumber(balance.ogTemple);
            setUnstakeAmount(amount);
          }}
          min={0}
          hint={`Balance: ${formatNumber(formatBigNumber(balance.ogTemple))}`}
        />
      </InputWrapper>
      <UnstakeButton disabled={buttonIsDisabled} onClick={() => unstake(unstakeAmount)}>
        Unstake {TICKER_SYMBOL.OG_TEMPLE_TOKEN}
      </UnstakeButton>
    </Popover>
  );
};

const InputWrapper = styled.div`
  margin-bottom: 1rem;
`;

const UnstakeButton = styled(Button)`
  width: 150px;
  height: 60px;
  background: linear-gradient(180deg, #353535 45.25%, #101010 87.55%);
  border: 1px solid #95613f;
  box-shadow: 0px 0px 20px rgba(222, 92, 6, 0.4);
  border-radius: 0.75rem;
  font-weight: 700;
  font-size: 1rem;
  letter-spacing: 0.1rem;
  text-transform: uppercase;
  color: #ffdec9;
  margin-left: auto;
  margin-right: auto;
  margin-top: 10px;
`;

const UnstakeTitle = styled.div`
  font-size: 24px;
  line-height: 28px;
  display: flex;
  align-items: center;
  color: #bd7b4f;
  padding-bottom: 20px;
`;

export default UnstakeOgtModal;
