import { Popover } from 'components/Popover';
import styled from 'styled-components';
import { Button } from 'components/Button/Button';
import { useWallet } from 'providers/WalletProvider';
import { useRefreshWalletState } from 'hooks/use-refresh-wallet-state';
import { useEffect, useState } from 'react';
import { useUnstakeOGTemple } from 'hooks/core/use-unstake-ogtemple';
import { formatBigNumber, formatTemple, getBigNumberFromString } from 'components/Vault/utils';
import { ZERO } from 'utils/bigNumber';

interface IProps {
  isOpen: boolean;
  onClose: () => void;
}

export const UnstakeOgtModal: React.FC<IProps> = ({ isOpen, onClose }) => {
  const { balance } = useWallet();
  const [_, refreshWallet] = useRefreshWalletState();
  const [unstakeAmount, setUnstakeAmount] = useState<string>('');
  const [unstake, { isLoading: unstakeLoading }] = useUnstakeOGTemple(() => {
    refreshWallet();
    setUnstakeAmount('');
  });

  useEffect(() => {
    const amount = balance.OGTEMPLE.eq(ZERO) ? '' : formatBigNumber(balance.OGTEMPLE);
    setUnstakeAmount(amount);
  }, [balance]);

  const bigAmount = getBigNumberFromString(unstakeAmount || '0');
  const buttonIsDisabled =
    unstakeLoading || !unstakeAmount || balance.OGTEMPLE.lte(ZERO) || bigAmount.gt(balance.OGTEMPLE);

  return (
    <>
      <Popover isOpen={isOpen} onClose={onClose} closeOnClickOutside showCloseButton>
        <UnstakeOgtContainer>
          <UnstakeTitle>Unstake OGT</UnstakeTitle>
          <UnstakeSubtitle>You are eligible to unstake:</UnstakeSubtitle>
          <TempleAmountContainer>
            <Temple>$OGTEMPLE</Temple>
            <TempleAmount>{balance.OGTEMPLE ? formatTemple(balance.OGTEMPLE) : '0.00'}</TempleAmount>
          </TempleAmountContainer>
          <UnstakeButton disabled={buttonIsDisabled} onClick={() => unstake(unstakeAmount)}>
            Unstake
          </UnstakeButton>
        </UnstakeOgtContainer>
      </Popover>
    </>
  );
};

const UnstakeButton = styled(Button)`
  width: 100px;
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

const TempleAmount = styled.div`
  font-size: 36px;
  display: flex;
  align-items: center;
  text-align: right;
  color: #ffdec9;
  padding: 20px;
`;

const Temple = styled.div`
  font-style: normal;
  font-size: 36px;
  display: flex;
  letter-spacing: 0.05em;
  color: #ffdec9;
  margin-right: auto;
`;

const UnstakeSubtitle = styled.div`
  font-style: normal;
  font-weight: 700;
  font-size: 16px;
  line-height: 20px;
  align-items: center;
  letter-spacing: 0.1em;
  color: #bd7b4f;
`;

const UnstakeTitle = styled.div`
  font-size: 24px;
  line-height: 28px;
  display: flex;
  align-items: center;
  color: #bd7b4f;
  padding-bottom: 20px;
`;

const TempleAmountContainer = styled.div`
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  align-items: center;
  margin-top: 20px;
  margin-bottom: 20px;
`;

const UnstakeOgtContainer = styled.div`
  display: flex;
  flex-direction: column;
  width: 350px;
`;

export default UnstakeOgtModal;
