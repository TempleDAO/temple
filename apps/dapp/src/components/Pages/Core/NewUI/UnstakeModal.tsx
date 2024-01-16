import { Popover } from 'components/Popover';
import styled from 'styled-components';
import { Button } from 'components/Button/Button';
import { useWallet } from 'providers/WalletProvider';
import { useRefreshWalletState } from 'hooks/use-refresh-wallet-state';
import { useEffect, useState } from 'react';
import { useUnstakeOGTemple } from 'hooks/core/use-unstake-ogtemple';
import {
  formatBigNumber,
  formatTemple,
  getBigNumberFromString,
} from 'components/Vault/utils';
import { ZERO } from 'utils/bigNumber';
import { useStaking } from 'providers/StakingProvider';
import { BigNumber } from 'ethers';

interface IProps {
  isOpen: boolean;
  onClose: () => void;
}

export const UnstakeOgtModal: React.FC<IProps> = ({ isOpen, onClose }) => {
  const { wallet, signer, balance, updateBalance } = useWallet();
  const [_, refreshWallet] = useRefreshWalletState();
  const [unstakeAmount, setUnstakeAmount] = useState<string>('');
  const { lockedEntries, updateLockedEntries, claimOgTemple } = useStaking();
  const [unstake, { isLoading: unstakeLoading }] = useUnstakeOGTemple(() => {
    refreshWallet();
    setUnstakeAmount('');
  });

  useEffect(() => {
    const amount = balance.OGTEMPLE.eq(ZERO)
      ? ''
      : formatBigNumber(balance.OGTEMPLE);
    setUnstakeAmount(amount);
  }, [balance]);

  useEffect(() => {
    const onMount = async () => {
      if (wallet && signer) await updateLockedEntries();
    };
    onMount();
  }, [wallet, signer]);

  const bigAmount = getBigNumberFromString(unstakeAmount || '0');
  const buttonIsDisabled =
    unstakeLoading ||
    !unstakeAmount ||
    balance.OGTEMPLE.lte(ZERO) ||
    bigAmount.gt(balance.OGTEMPLE);

  const handleUnlockOGT = async () => {
    try {
      lockedEntries.map(async (entry) => {
        if (Date.now() > entry.lockedUntilTimestamp) await claimOgTemple(0);
        updateLockedEntries();
        updateBalance();
      });
    } catch (e) {
      console.log(e);
    }
  };

  return (
    <>
      <Popover
        isOpen={isOpen}
        onClose={onClose}
        closeOnClickOutside
        showCloseButton
      >
        <ModalContainer>
          <Title>Unstake OGTemple</Title>
          {/* Display Unlock if they have lockedOGT, then display Unstake */}
          {lockedEntries.length > 0 ? (
            <>
              <Subtitle>
                You can claim locked OGTemple from the Opening Ceremony:
              </Subtitle>
              <ClaimButton
                isSmall
                onClick={() => handleUnlockOGT()}
                disabled={Date.now() < lockedEntries[0].lockedUntilTimestamp}
              >
                Claim{' '}
                {formatTemple(
                  lockedEntries.reduce(
                    (sum, cur) => sum.add(cur.balanceOGTemple),
                    BigNumber.from('0')
                  )
                )}{' '}
                OGTemple
              </ClaimButton>
              <Subtitle>
                {lockedEntries.length > 1 && (
                  <span>
                    You will have {lockedEntries.length} transactions to claim
                    your locked OGTemple.
                    <br />
                    <br />
                  </span>
                )}
                After unlocking OGT, you will be able to convert it to TEMPLE on
                this same screen.
              </Subtitle>
            </>
          ) : (
            <>
              <Subtitle>
                You have{' '}
                {balance.OGTEMPLE ? formatTemple(balance.OGTEMPLE) : '0.00'} OGT
                you can unstake and convert to TEMPLE.
              </Subtitle>
              <ClaimButton
                isSmall
                disabled={buttonIsDisabled}
                onClick={() => unstake(unstakeAmount)}
                style={{ margin: '1rem auto 0 auto' }}
              >
                Unstake OGTEMPLE
              </ClaimButton>
            </>
          )}
        </ModalContainer>
      </Popover>
    </>
  );
};

const ClaimButton = styled(Button)`
  background: ${({ theme }) => theme.palette.gradients.dark};
  color: ${({ theme }) => theme.palette.brandLight};
  border: 1px solid #95613f;
  box-shadow: 0px 0px 20px rgba(222, 92, 6, 0.4);
  border-radius: 0.75rem;
  font-weight: 700;
  font-size: 1rem;
  letter-spacing: 0.1rem;
  text-transform: uppercase;
  width: max-content;
  margin: 1rem auto;
`;

const Subtitle = styled.div`
  color: ${({ theme }) => theme.palette.brand};
  letter-spacing: 0.05rem;
  line-height: 1.25rem;
`;

const Title = styled.div`
  font-size: 1.5rem;
  padding-bottom: 1rem;
  color: ${({ theme }) => theme.palette.brandLight};
`;

const ModalContainer = styled.div`
  display: flex;
  flex-direction: column;
  justify-content: center;
  text-align: center;
  color: ${({ theme }) => theme.palette.brand};
  width: 350px;
`;

export default UnstakeOgtModal;
