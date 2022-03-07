import React, { useCallback, useEffect, useState } from 'react';
import { JsonRpcSigner } from '@ethersproject/providers';
import devotionImage from 'assets/images/DEVOTION.svg';
import {
  ConvoFlowTitle,
  TitleWrapper,
  TooltipTitle,
  ViewContainer,
} from 'components/AMM/helpers/components';
import { copyBalance } from 'components/AMM/helpers/methods';
import { Button } from 'components/Button/Button';
import styled from 'styled-components';
import { DataCard } from 'components/DataCard/DataCard';
import Image from 'components/Image/Image';
import { Input } from 'components/Input/Input';
import { Flex } from 'components/Layout/Flex';
import Tooltip, { TooltipIcon } from 'components/Tooltip/Tooltip';
import { BigNumber } from 'ethers';
import { useWallet } from 'providers/WalletProvider';
import { useFaith } from 'providers/FaithProvider';
import { useRefreshWalletState } from 'hooks/use-refresh-wallet-state';
import { TICKER_SYMBOL } from 'enums/ticker-symbol';
import { FaithBalance } from 'providers/types';
import { Devotion__factory } from 'types/typechain';
import { fromAtto } from 'utils/bigNumber';
import { formatNumber } from 'utils/formatter';

const ENV_VARS = import.meta.env;
const TEMPLE_DEVOTION_ADDRESS = ENV_VARS.VITE_PUBLIC_TEMPLE_DEVOTION_ADDRESS;
const SECONDS_IN_DAY = 86400;
const Devotion = () => {
  const { balance, signer, wallet } = useWallet();
  const { faith, verifyFaith, getTempleFaithReward, redeemFaith } = useFaith();

  // This is the available OGTemple for the Templar
  const [devotion, setDevotion] = useState<number>(0);
  const [faithBalance, setFaithBalance] = useState<FaithBalance>({
    usableFaith: 0,
    lifeTimeFaith: 0,
    totalSupply: 0,
    share: 0,
  });
  const [faithAmount, setFaithAmount] = useState<number | ''>('');
  const [rewards, setRewards] = useState<number>(0);

  const [devotionStage, setDevotionStage] = useState(-1);
  const [devotionWon, setDevotionWon] = useState(false);
  const [hasVerifiedFaith, setHasVerifiedFaith] = useState(false);
  const [minimumLockPeriodDays, setMinimumLockPeriodDays] = useState(0);

  const refreshWalletState = useRefreshWalletState();

  const getDevotionData = useCallback(
    async (signer: JsonRpcSigner) => {
      if (signer && wallet) {
        const DEVOTION = new Devotion__factory(signer).attach(
          TEMPLE_DEVOTION_ADDRESS
        );
        const round = await DEVOTION.currentRound();
        const roundStatus = await DEVOTION.roundStatus(round);
        const hasVerifiedCurrentRound = await DEVOTION.verifiedFaith(
          round,
          wallet
        );
        const minimumLockPeriod = await DEVOTION.minimumLockPeriod();

        setMinimumLockPeriodDays(
          formatNumber(minimumLockPeriod.toNumber() / SECONDS_IN_DAY)
        );
        setDevotionWon(roundStatus.isWon);
        setDevotionStage(roundStatus.stage);
        setHasVerifiedFaith(hasVerifiedCurrentRound);
      }
    },
    [wallet]
  );

  useEffect(() => {
    if (signer && wallet) {
      void getDevotionData(signer);
    }
  }, [getDevotionData, signer, wallet]);

  useEffect(() => {
    async function onMount() {
      await refreshWalletState();
    }

    void onMount();
  }, []);

  useEffect(() => {
    if (balance) {
      setDevotion(formatNumber(balance.ogTemple));
    }
  }, [balance]);

  useEffect(() => {
    if (faith) {
      setFaithBalance(faith);
    }
  }, [faith]);

  const handleVerifyFaith = async () => {
    try {
      if (devotion) {
        await verifyFaith();
        await refreshWalletState();
      }
    } catch (e) {
      console.info(e);
    }
  };

  const handleRedeemFaith = async () => {
    try {
      if (faithAmount) {
        await redeemFaith(BigNumber.from(faithAmount));
        await refreshWalletState();
        setFaithAmount('');
      }
    } catch (e) {
      console.info(e);
    }
  };

  const handleFaithUpdate = async (value: number | '') => {
    setFaithAmount(value === 0 ? '' : value);
    if (value) {
      setRewards(
        fromAtto(
          (await getTempleFaithReward(BigNumber.from(value))) ||
            BigNumber.from(0)
        )
      );
    } else {
      setRewards(0);
    }
  };

  return (
    <ViewContainer>
      {devotionStage === 2 ? (
        devotionWon ? (
          <>
            <Sigil src={devotionImage} width={72} height={72} />
            <TitleWrapper>
              <ConvoFlowTitle>TEMPLE DEVOTION WAS SUCCESSFUL</ConvoFlowTitle>
              <TooltipTitle>
                <Tooltip
                  content={
                    <small>
                      Congratulations Templar! The devotees arrived and the
                      target price was achieved by the Templars.
                      <br />
                      You may now redeem your {TICKER_SYMBOL.FAITH} for Bonus{' '}
                      {TICKER_SYMBOL.OG_TEMPLE_TOKEN}.
                      <br />
                      Choose how much {TICKER_SYMBOL.FAITH} you wish to redeem.{' '}
                      {TICKER_SYMBOL.FAITH} can be saved for later redemption,
                      future airdrops, and for other benefits in the
                      Templeverse.
                    </small>
                  }
                  position={'top'}
                >
                  <TooltipIcon />
                </Tooltip>
              </TooltipTitle>
            </TitleWrapper>
            <Input
              hint={`Balance: ${formatNumber(faithBalance.usableFaith)}`}
              onHintClick={() =>
                copyBalance(faithBalance.usableFaith, handleFaithUpdate)
              }
              crypto={{ kind: 'value', value: TICKER_SYMBOL.FAITH }}
              isNumber
              max={faithBalance.usableFaith}
              min={0}
              value={faithAmount}
              handleChange={handleFaithUpdate}
              placeholder={'0.00'}
            />
            <Flex
              layout={{
                kind: 'container',
              }}
            >
              <Flex
                layout={{
                  kind: 'item',
                }}
              >
                <DataCard
                  title={`BONUS ${TICKER_SYMBOL.OG_TEMPLE_TOKEN}`}
                  data={`${formatNumber(rewards) || 0}`}
                  small
                />
              </Flex>
              <Flex
                layout={{
                  kind: 'item',
                }}
              >
                <DataCard
                  title={`FAITH SHARE`}
                  data={`${formatNumber(faith.share)} %`}
                  small
                />
              </Flex>
            </Flex>
            <Button
              label={'redeem FAITH'}
              isUppercase
              onClick={handleRedeemFaith}
              disabled={
                faithAmount === '' ||
                faith.usableFaith === 0 ||
                faith.usableFaith < faithAmount
              }
            />
            <Spacer />
          </>
        ) : (
          <TitleWrapper>
            <ConvoFlowTitle>TEMPLE DEVOTION CLAIMS NOT ACTIVE</ConvoFlowTitle>
          </TitleWrapper>
        )
      ) : hasVerifiedFaith ? (
        <p>
          You have already verified your $FAITH for the current round of
          Devotion.
        </p>
      ) : (
        <>
          <Sigil src={devotionImage} width={72} height={72} />
          <TitleWrapper>
            <ConvoFlowTitle>TEMPLE DEVOTION ENGAGED</ConvoFlowTitle>
            <TooltipTitle>
              <Tooltip
                content={
                  <small>
                    Temple Devotion is active. During this 24 hours, if you lock
                    {TICKER_SYMBOL.OG_TEMPLE_TOKEN} you gain{' '}
                    {TICKER_SYMBOL.FAITH}. {TICKER_SYMBOL.FAITH} can be redeemed
                    for Bonus APY, future airdrops, and other benefits in the
                    Templeverse.
                    <br />
                    Faith can be redeemed only if the target price is reached at
                    the end of the 24 hour game window.
                  </small>
                }
                position={'top'}
              >
                <TooltipIcon />
              </Tooltip>
            </TooltipTitle>
          </TitleWrapper>
          <Flex
            layout={{
              kind: 'container',
              canWrap: true,
              canWrapTablet: false,
            }}
          >
            <Flex
              layout={{
                kind: 'item',
              }}
            >
              <DataCard
                title={`${TICKER_SYMBOL.OG_TEMPLE_TOKEN} TO LOCK`}
                data={`+ ${devotion}`}
                tooltipContent={`All OGTEMPLE in your wallet as well as in the locking contract will be locked for ${minimumLockPeriodDays} days.`}
                small
              />
            </Flex>
            <Flex
              layout={{
                kind: 'item',
              }}
            >
              <DataCard
                title={`${TICKER_SYMBOL.FAITH} Gained`}
                data={`+ ${devotion}`}
                tooltipContent={
                  'You gain 1 Faith for each OGTEMPLE that is locked.'
                }
                small
              />
            </Flex>
          </Flex>
          <Button
            label={'VERIFY FAITH'}
            isUppercase
            onClick={handleVerifyFaith}
            disabled={devotion === 0}
          />
          <Spacer />
          {balance.ogTempleLocked > 0 && (
            <>
              <small>
                You have{' '}
                <small className={'color-brand'}>
                  {TICKER_SYMBOL.OG_TEMPLE_TOKEN}
                </small>{' '}
                to be claimed from the Fire Ritual or Opening Ceremony
                contracts. <br />
                This{' '}
                <small className={'color-brand'}>
                  {TICKER_SYMBOL.OG_TEMPLE_TOKEN}
                </small>{' '}
                will not be verified or re-locked until it is claimed.
              </small>
              <Spacer />
            </>
          )}
        </>
      )}
    </ViewContainer>
  );
};

/* TODO: move this to a common component so it can be reused */
const Spacer = styled.div`
  height: 1rem;
`;

const Sigil = styled(Image)`
  margin-bottom: 1rem;
  width: 100%;
  text-align: center;
`;

export default Devotion;
