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
import { useConnectWallet } from '@web3-onboard/react';
import { TradeButton } from '../../NewUI/Home';

export const UnstakeOGT = () => {
  const [{}, connect] = useConnectWallet();
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
      if (wallet && signer) {
        await Promise.all([updateLockedEntries(), updateBalance()]);
      }
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
        await Promise.all([updateLockedEntries(), updateBalance()]);
      });
    } catch (e) {
      console.log(e);
    }
  };

  return (
    <UnstakeContainer>
      <Title>Unstake OGTemple</Title>
      {/* Display Unlock if they have lockedOGT, then display Unstake */}
      {lockedEntries.length > 0 ? (
        <>
          <TopSubtitle>
            You can claim locked OGTemple from the Opening Ceremony:
          </TopSubtitle>
          {!wallet ? (
            <TradeButton
              label={`Connect`}
              onClick={() => {
                connect();
              }}
            />
          ) : (
            <TradeButton
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
            </TradeButton>
          )}
          <Subtitle>
            {lockedEntries.length > 1 && (
              <span>
                You will have {lockedEntries.length} transactions to claim your
                locked OGTemple.
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
            {balance.OGTEMPLE ? formatTemple(balance.OGTEMPLE) : '0.00'} OGT you
            can unstake and convert to TEMPLE.
          </Subtitle>
          <ButtonContainer>
            {!wallet ? (
              <TradeButton
                label={`Connect`}
                onClick={() => {
                  connect();
                }}
              />
            ) : (
              <TradeButton
                disabled={buttonIsDisabled}
                onClick={() => unstake(unstakeAmount)}
              >
                Unstake
              </TradeButton>
            )}
          </ButtonContainer>
        </>
      )}
    </UnstakeContainer>
  );
};

const ButtonContainer = styled.div`
  display: flex;
`;

const TopSubtitle = styled.div`
  color: ${({ theme }) => theme.palette.brand};
  letter-spacing: 0.05rem;
  line-height: 1.25rem;
  text-align: center;
`;

const Subtitle = styled.div`
  color: ${({ theme }) => theme.palette.brand};
  letter-spacing: 0.05rem;
  line-height: 1.25rem;
  margin-top: 20px;
  text-align: center;
`;

const Title = styled.div`
  padding-bottom: 1rem;
  color: ${({ theme }) => theme.palette.brandLight};
  padding-bottom: 1rem;
  font-size: 36px;
  line-height: 42px;
`;

const UnstakeContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  color: ${({ theme }) => theme.palette.brand};
  width: 350px;
`;

export default UnstakeOGT;
