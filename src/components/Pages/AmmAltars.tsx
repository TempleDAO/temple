import EnterBgImage from 'assets/images/altar-enter-bg.jpg';
import ExitBgImage from 'assets/images/altar-exit.jpg';
import crossImage from 'assets/images/cross.svg';
import DevotionBgImage from 'assets/images/devotion_bg.jpg';
import ClaimOGTemple from 'components/AMM/ClaimOGTemple';
import { Button } from 'components/Button/Button';
import { DataCard } from 'components/DataCard/DataCard';
import Image from 'components/Image/Image';
import { Input } from 'components/Input/Input';
import { Flex } from 'components/Layout/Flex';
import { STABLE_COIN_SYMBOL } from 'components/Pages/Rituals';
import PercentageBar from 'components/PercentageBar/PercentageBar';
import Slippage from 'components/Slippage/Slippage';
import Tooltip, { TooltipIcon } from 'components/Tooltip/Tooltip';
import dateFormat from 'dateformat';
import { BigNumber } from 'ethers';
import withWallet from 'hoc/withWallet';
import { CustomRoutingPage } from 'hooks/use-custom-spa-routing';
import {
  JoinQueueData,
  OG_TEMPLE_TOKEN,
  RitualKind,
  TEMPLE_TOKEN,
  useWallet,
} from 'providers/WalletProvider';
import React, { ReactNode, useEffect, useState } from 'react';
import styled, { css } from 'styled-components';
import { fromAtto, toAtto } from 'utils/bigNumber';
import { formatNumber } from 'utils/formatter';
import { noop } from 'utils/helpers';

const ENV_VARS = import.meta.env;

export enum AMMView {
  BUY = 'BUY',
  STAKE = 'STAKE',

  UNLOCK = 'UNLOCK OGTEMPLE',
  JOIN_QUEUE = 'JOIN QUEUE',
  WITHDRAW = 'WITHDRAW TEMPLE',
  SELL = 'SELL',
  BTFD = 'BTFD',

  EXCHANGE_TRADE = 'TRADE',
  EXCHANGE_DEFEND = 'DEFEND',
  EXCHANGE_WITHDRAW = 'WITHDRAW',
}

// CustomRoutingPage does not take view as prop
//@ts-ignore
const AMMAltars: CustomRoutingPage = ({ routingHelper, view }) => {
  const {
    balance,
    claimOgTemple,
    claimAvailableTemple,
    restakeAvailableTemple,
    exitQueueData,
    getBalance,
    getRewardsForOGT,
    increaseAllowanceForRitual,
    lockedEntries,
    updateWallet,
    buy,
    sell,
    getJoinQueueData,
    getSellQuote,
    getBuyQuote,
    stake,
    apy,
    templePrice,
  } = useWallet();

  const { back } = routingHelper;

  // OGT amount in the user wallet
  const [OGTWalletAmount, setOGTWalletAmount] = useState<number>(0);
  // StableCoin in the user wallet (Frax)
  const [stableCoinWalletAmount, setStableCoinWalletAmount] =
    useState<number>(0);
  const [stableCoinAmount, setStableCoinAmount] = useState<number | ''>('');
  // $TEMPLE in the user wallet
  const [templeWalletAmount, setTempleWalletAmount] = useState<number>(0);
  const [templeAmount, setTempleAmount] = useState<number | ''>('');
  const [OGTAmount, setOGTAmount] = useState<number | ''>('');
  const [rewards, setRewards] = useState<number | ''>('');
  const [activeAMMView, setActiveAMMView] = useState<AMMView | null>(view);
  // Slippage for TXN minOut
  const [slippage, setSlippage] = useState<number>(1);
  // used to disable contract interaction if greater than amount out
  const [minAmountOut, setMinAmountOut] = useState<number>(0);
  const [joinQueueData, setJoinQueueData] = useState<JoinQueueData | null>({
    queueLength: 0,
    processTime: 0,
  });

  useEffect(() => {
    if (balance) {
      setOGTWalletAmount(balance.ogTemple);
      setStableCoinWalletAmount(balance.stableCoin);
      setTempleWalletAmount(balance.temple);
    }
  }, [balance]);

  useEffect(() => {
    async function onMount() {
      await updateWallet();
      setRewards('');
      setMinAmountOut(0);
    }

    onMount();
  }, []);

  useEffect(() => {
    function onKeyup(e: KeyboardEvent) {
      if (e.key === 'Escape') back();
    }

    window.addEventListener('keyup', onKeyup);
    return () => window.removeEventListener('keyup', onKeyup);
  }, [back]);

  const updateTempleRewards = async (ogtAmount: number) => {
    setRewards((await getRewardsForOGT(ogtAmount)) || 0);
  };

  const updateJoinQueueData = async (ogtAmount: number) => {
    setJoinQueueData(
      (await getJoinQueueData(toAtto(ogtAmount))) || {
        queueLength: 0,
        processTime: 0,
      }
    );
  };

  const handleSetActiveAMMView = async (
    view: AMMView | null,
    shouldUpdateData = true
  ) => {
    if (shouldUpdateData) {
      await updateWallet();
    }
    setRewards(0);
    setActiveAMMView(view);
  };

  const handleClaimOgTemple = async (index: number) => {
    console.info(`handleClaimOgTemple: ${index}`);
    await claimOgTemple(index);
    // fetch new LockedEntries
    updateWallet();
  };

  const handleUpdateOGT = (value: number | '') => {
    setOGTAmount(value === 0 ? '' : value);

    void updateTempleRewards(value === '' ? 0 : value);
    void updateJoinQueueData(value === '' ? 0 : value);
  };

  const handleUpdateSlippageForBuy = async (value: number) => {
    setSlippage(value);
  };

  const handleUpdateSlippageForSell = async (value: number) => {
    setSlippage(value);
  };

  const handleUpdateStableCoinAmount = async (value: number | '') => {
    setStableCoinAmount(value === 0 ? '' : value);
    if (value) {
      setRewards(
        fromAtto((await getBuyQuote(toAtto(value))) || BigNumber.from(0) || 0)
      );
    } else {
      setRewards('');
    }
  };

  const handleUpdateTempleAmmount = async (value: number) => {
    setTempleAmount(value === 0 ? '' : value);
  };

  const handleUpdateTempleAmount = async (value: number | '') => {
    setTempleAmount(value === 0 ? '' : value);
    console.log('val', value);
    if (value) {
      setRewards(
        fromAtto((await getSellQuote(toAtto(value))) || BigNumber.from(0) || 0)
      );
    } else {
      console.log(`here`);
      setRewards('');
    }
  };

  const handleUnlockOGT = async () => {
    try {
      if (OGTAmount) {
        console.info(`handleUnlockOGT => ${OGTAmount}`);
        await increaseAllowanceForRitual(
          toAtto(OGTAmount),
          RitualKind.OGT_UNLOCK,
          'OGTEMPLE'
        );
        getBalance();
      }
    } catch (e) {
      console.info(e);
    }
  };

  const handleSacrificeStableCoin = async () => {
    try {
      if (stableCoinAmount) {
        console.info(`PRICE: ${templePrice}`);
        // ( 'FRAX sacrificing' / 'current price' )  * (1 - SlippageSetting )
        const minAmountOut =
          (stableCoinAmount / templePrice) * (1 - slippage / 100);
        setMinAmountOut(minAmountOut);
        if (minAmountOut <= rewards) {
          await buy(toAtto(stableCoinAmount), toAtto(minAmountOut));
          getBalance();
        }
      }
    } catch (e) {
      console.info(e);
    }
  };

  const handleSurrenderTemple = async () => {
    try {
      if (templeAmount) {
        // ( 'current price' * 'FRAX sacrificing' )  * (1 - SlippageSetting )
        const minAmountOut = templeAmount * templePrice * (1 - slippage / 100);
        setMinAmountOut(minAmountOut);
        if (minAmountOut <= rewards) {
          await sell(toAtto(templeAmount), toAtto(minAmountOut));
          getBalance();
        }
      }
    } catch (e) {
      console.info(e);
    }
  };

  const handleTempleStake = async () => {
    try {
      if (templeAmount) {
        await stake(toAtto(templeAmount));
        getBalance();
      }
    } catch (e) {
      console.info(e);
    }
  };

  const copyBalance = (value: number, fn: (value: number) => void) => {
    if (value > 0) {
      fn(value);
    }
  };

  const renderAMMView = (): ReactNode => {
    switch (activeAMMView) {
      case AMMView.BUY:
        return (
          <>
            <TitleWrapper>
              <ConvoFlowTitle>HOW DEDICATED ARE YOU, TEMPLAR?</ConvoFlowTitle>
            </TitleWrapper>
            <Input
              hint={`Balance: ${formatNumber(stableCoinWalletAmount)}`}
              onHintClick={() =>
                copyBalance(
                  stableCoinWalletAmount,
                  handleUpdateStableCoinAmount
                )
              }
              crypto={{ kind: 'value', value: STABLE_COIN_SYMBOL }}
              isNumber
              max={stableCoinWalletAmount}
              min={0}
              value={stableCoinAmount}
              handleChange={
                ENV_VARS.VITE_PUBLIC_AMM_STOPPED === 'true'
                  ? noop
                  : handleUpdateStableCoinAmount
              }
              placeholder={'0.00'}
            />
            <Input
              hint={`Balance: ${formatNumber(templeWalletAmount)}`}
              crypto={{ kind: 'value', value: TEMPLE_TOKEN }}
              type={'number'}
              value={formatNumber(rewards as number)}
              placeholder={'0.00'}
              isNumber
              disabled
            />
            <Slippage
              label={`${TEMPLE_TOKEN}: (${formatNumber(templePrice)})`}
              value={slippage}
              onChange={
                ENV_VARS.VITE_PUBLIC_AMM_STOPPED === 'true'
                  ? noop
                  : handleUpdateSlippageForBuy
              }
            />
            <Spacer />
            <Button
              label={
                minAmountOut > rewards
                  ? 'increase slippage'
                  : `sacrifice ${STABLE_COIN_SYMBOL}`
              }
              isUppercase
              onClick={
                ENV_VARS.VITE_PUBLIC_AMM_STOPPED === 'true'
                  ? noop
                  : handleSacrificeStableCoin
              }
              disabled={
                ENV_VARS.VITE_PUBLIC_AMM_STOPPED === 'true' ||
                stableCoinAmount === 0 ||
                stableCoinWalletAmount === 0
              }
            />
          </>
        );
      case AMMView.SELL:
        return (
          <>
            <TitleWrapper>
              <ConvoFlowTitle>ARE YOU SURE, TEMPLAR?</ConvoFlowTitle>
            </TitleWrapper>
            <Input
              hint={`Balance: ${formatNumber(templeWalletAmount)}`}
              onHintClick={() =>
                copyBalance(templeWalletAmount, handleUpdateTempleAmount)
              }
              crypto={{ kind: 'value', value: TEMPLE_TOKEN }}
              max={templeWalletAmount}
              min={0}
              value={templeAmount}
              handleChange={
                ENV_VARS.VITE_PUBLIC_AMM_STOPPED === 'true'
                  ? noop
                  : handleUpdateTempleAmount
              }
              placeholder={'0.00'}
              isNumber
            />
            <Input
              hint={`BALANCE: ${formatNumber(stableCoinWalletAmount)}`}
              crypto={{ kind: 'value', value: STABLE_COIN_SYMBOL }}
              isNumber
              value={formatNumber(rewards as number)}
              placeholder={'0.00'}
              disabled
            />
            <Slippage
              label={`${TEMPLE_TOKEN}: (${formatNumber(templePrice)})`}
              value={slippage}
              onChange={
                ENV_VARS.VITE_PUBLIC_AMM_STOPPED === 'true'
                  ? noop
                  : handleUpdateSlippageForSell
              }
            />
            <br />
            <Button
              label={
                minAmountOut > rewards
                  ? 'increase slippage'
                  : `RENOUNCE YOUR ${TEMPLE_TOKEN}`
              }
              isUppercase
              onClick={
                ENV_VARS.VITE_PUBLIC_AMM_STOPPED === 'true'
                  ? noop
                  : handleSurrenderTemple
              }
              disabled={
                ENV_VARS.VITE_PUBLIC_AMM_STOPPED === 'true' ||
                templeAmount === 0
              }
            />
          </>
        );
      case AMMView.STAKE:
        return (
          <>
            <>
              <TitleWrapper>
                <ConvoFlowTitle>PLEDGE YOUR {TEMPLE_TOKEN}</ConvoFlowTitle>
                <Tooltip
                  content={
                    <small>
                      You will receive $OGTEMPLE when you pledge your $TEMPLE to
                      the staking contract.
                    </small>
                  }
                  position={'top'}
                >
                  <TooltipIcon />
                </Tooltip>
              </TitleWrapper>
              <Input
                hint={`Balance: ${formatNumber(templeWalletAmount)}`}
                onHintClick={() =>
                  copyBalance(templeWalletAmount, setTempleAmount)
                }
                crypto={{ kind: 'value', value: TEMPLE_TOKEN }}
                isNumber
                max={templeWalletAmount}
                min={0}
                value={templeAmount}
                handleChange={handleUpdateTempleAmmount}
                placeholder={'0.00'}
              />
              <DataCard title={`APY`} data={formatNumber(apy || 0) + '%'} />
              <br />
              <br />
              <Button
                label={`PLEDGE`}
                isUppercase
                onClick={handleTempleStake}
                disabled={templeAmount === 0}
              />
            </>
          </>
        );
      case AMMView.UNLOCK:
        return (
          <>
            <TitleWrapper>
              <ConvoFlowTitle>CLAIM YOUR {OG_TEMPLE_TOKEN}</ConvoFlowTitle>
              <Tooltip
                content={
                  <small>
                    All your $OGTEMPLE in the locking contract are represented
                    here. if your $OGTEMPLE have unlocked, they will be able to
                    be claimed.
                  </small>
                }
                position={'top'}
              >
                <TooltipIcon />
              </Tooltip>
            </TitleWrapper>
            <ClaimOGTemple
              lockedEntries={lockedEntries}
              onClaim={handleClaimOgTemple}
            />
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
                  col: 'half',
                }}
              >
                <Button
                  label={'RETURN TO ALTAR'}
                  isSmall
                  isUppercase
                  onClick={back}
                />
              </Flex>
              <Flex
                layout={{
                  kind: 'item',
                  col: 'half',
                }}
              >
                <Button
                  label={'PROCEED TO EXIT QUEUE'}
                  isSmall
                  isUppercase
                  onClick={() => handleSetActiveAMMView(AMMView.JOIN_QUEUE)}
                />
              </Flex>
            </Flex>
          </>
        );
      case AMMView.JOIN_QUEUE:
        return (
          <>
            <TitleWrapper>
              <ConvoFlowTitle>
                SELECT {OG_TEMPLE_TOKEN} TO UNSTAKE VIA QUEUE
              </ConvoFlowTitle>
              <Tooltip
                content={
                  <small>
                    Your $TEMPLE tokens are unstaked by burning your $OGTEMPLE
                    and joining the exit queue. The queue is processed first in,
                    first out. Once you are processed you will be able to claim
                    your $TEMPLE tokens.
                  </small>
                }
                position={'top'}
              >
                <a
                  className={'color-dark'}
                  target={'_blank'}
                  href="https://docs.templedao.link/templedao/temple-mechanics"
                  rel="noreferrer"
                >
                  <TooltipIcon />
                </a>
              </Tooltip>
            </TitleWrapper>

            <Input
              hint={`Balance: ${formatNumber(OGTWalletAmount)}`}
              onHintClick={() => copyBalance(OGTWalletAmount, handleUpdateOGT)}
              crypto={{ kind: 'value', value: 'OGTEMPLE' }}
              isNumber
              max={OGTWalletAmount}
              min={0}
              value={OGTAmount}
              handleChange={handleUpdateOGT}
              placeholder={'0.00'}
            />
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
                  col: 'third',
                }}
              >
                <DataCard
                  title={'TEMPLE + REWARDS'}
                  data={formatNumber(rewards as number) + ''}
                  tooltipContent={
                    'Amount of $TEMPLE received once you exit the queue'
                  }
                />
              </Flex>
              <Flex
                layout={{
                  kind: 'item',
                  col: 'third',
                }}
              >
                <DataCard
                  title={'QUEUE LENGTH'}
                  data={joinQueueData?.queueLength + ' DAYS'}
                  tooltipContent={
                    'The current length of the queue due to other templars waiting to be processed in front of you.'
                  }
                />
              </Flex>
              <Flex
                layout={{
                  kind: 'item',
                  col: 'third',
                }}
              >
                <DataCard
                  title={'PROCESS TIME'}
                  data={`+ ${joinQueueData?.processTime} DAYS`}
                  tooltipContent={
                    'Amount of time it takes to process the $OGTEMPLE that you have selected. your processing will begin in the number of days specified in the current ‘queue length’.'
                  }
                />
              </Flex>
            </Flex>
            <br />
            <Button
              label={'BURN $OG TEMPLE & JOIN QUEUE'}
              onClick={handleUnlockOGT}
              isUppercase
              disabled={
                OGTAmount === 0 ||
                (balance != undefined && OGTAmount > balance.ogTemple)
              }
            />
          </>
        );
      case AMMView.WITHDRAW:
        return (
          <>
            <TitleWrapper>
              <ConvoFlowTitle>
                YOU HAVE {exitQueueData.totalTempleOwned} {TEMPLE_TOKEN} IN
                QUEUE
              </ConvoFlowTitle>
              <Tooltip
                content={
                  <small>
                    the exit queue is used to provide an orderly unstaking
                    process from the temple
                  </small>
                }
                position={'top'}
              >
                <TooltipIcon />
              </Tooltip>
            </TitleWrapper>
            <PercentageBar
              total={exitQueueData.totalTempleOwned}
              processed={exitQueueData.claimableTemple}
            />
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
                  col: 'third',
                }}
              >
                <DataCard
                  title={'AVAILABLE TO CLAIM'}
                  data={formatNumber(exitQueueData.claimableTemple) + ''}
                  tooltipContent={
                    'Amount of $TEMPLE that has been processed and is available for withdrawal'
                  }
                />
              </Flex>
              <Flex
                layout={{
                  kind: 'item',
                  col: 'third',
                }}
              >
                <DataCard
                  title={'NOT PROCESSED'}
                  data={
                    formatNumber(
                      exitQueueData.totalTempleOwned -
                        exitQueueData.claimableTemple
                    ) + ''
                  }
                  tooltipContent={
                    'Amount of $TEMPLE yet to be processed through the queue'
                  }
                />
              </Flex>
              <Flex
                layout={{
                  kind: 'item',
                  col: 'third',
                }}
              >
                <DataCard
                  title={'QUEUE PROCESSED BY'}
                  data={`${dateFormat(
                    exitQueueData.lastClaimableEpochAt,
                    'dd, mmm h:MM TT'
                  )}`}
                  tooltipContent={
                    'The time at which all of your $TEMPLE will be available to withdraw'
                  }
                />
              </Flex>
            </Flex>
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
                  col: 'half',
                }}
              >
                <Button
                  label={'restake all temple'}
                  onClick={restakeAvailableTemple}
                  isUppercase
                  disabled={
                    exitQueueData.totalTempleOwned === 0 &&
                    exitQueueData.claimableTemple === 0
                  }
                />
              </Flex>
              <Flex
                layout={{
                  kind: 'item',
                  col: 'half',
                }}
              >
                <Button
                  label={'withdraw available temple'}
                  onClick={claimAvailableTemple}
                  isUppercase
                  disabled={exitQueueData.claimableTemple === 0}
                />
              </Flex>
            </Flex>
          </>
        );
      case AMMView.BTFD:
        return (
          <h4>This Altar room is quiet for now. You feel a sense of peace.</h4>
        );
      default:
        return null;
    }
  };

  const getBackgroundImage = () => {
    let bgImage = '';
    if (activeAMMView === 'BUY' || activeAMMView === 'STAKE') {
      bgImage = EnterBgImage;
    }
    if (
      activeAMMView === 'UNLOCK OGTEMPLE' ||
      activeAMMView === 'JOIN QUEUE' ||
      activeAMMView === 'WITHDRAW TEMPLE' ||
      activeAMMView === 'SELL'
    ) {
      bgImage = ExitBgImage;
    }
    if (activeAMMView === 'BTFD') {
      bgImage = DevotionBgImage;
    }

    return bgImage;
  };

  return (
    <>
      <Background backgroundUrl={() => getBackgroundImage()}>
        <ConvoFlowContent
          isSmall={
            activeAMMView === 'BUY' ||
            activeAMMView === 'STAKE' ||
            activeAMMView === 'SELL'
          }
          isDisabled={
            ENV_VARS.VITE_PUBLIC_AMM_STOPPED === 'true' &&
            (activeAMMView === 'BUY' || activeAMMView === 'SELL')
          }
        >
          <ConvoFlowClose
            src={crossImage}
            alt={'Close notification'}
            width={24}
            height={24}
            onClick={back}
          />
          {renderAMMView()}
        </ConvoFlowContent>
        <OffClickOverlay
          onClick={(e) => {
            if (activeAMMView) {
              e.preventDefault();
              e.stopPropagation();
              back();
            }
          }}
        />
      </Background>
    </>
  );
};

const TitleWrapper = styled.div`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  margin-bottom: 2rem;

  ${TooltipIcon} {
    margin-left: 2rem;
  }
`;

interface BackgroundProps {
  backgroundUrl(): string;
}

const Background = styled.div<BackgroundProps>`
  height: 100vh;
  width: 100vw;
  background-image: url(${(props) => props.backgroundUrl});
  background-size: cover;
  background-repeat: no-repeat;
  background-position: center bottom;

  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
`;

const OffClickOverlay = styled.div`
  position: absolute;
  height: 100vh;
  width: 100vw;
  z-index: 0;
  transition: background 300ms;
  background-color: ${(props) => props.theme.palette.dark75};
  opacity: 0.75;
`;

interface ConvoFlowContentProps {
  isSmall?: boolean;
  isDisabled?: boolean;
}

const ConvoFlowContent = styled.div<ConvoFlowContentProps>`
  position: relative;
  z-index: 100;
  width: 100%;
  max-width: 48.75rem /* 780/16 */;

  ${(props) =>
    props.isSmall &&
    css`
      max-width: 35rem /* 485/16 */;
    `}

  ${(props) =>
    props.isDisabled &&
    css`
      filter: grayscale(1);
      pointer-events: none;
      cursor: not-allowed;
    `}

  background-color: ${(props) => props.theme.palette.dark};
  padding: 2rem;
  border: 0.0625rem /* 1/16 */ solid ${(props) => props.theme.palette.brand};
`;

const ConvoFlowTitle = styled.p`
  text-align: center;
  color: ${(props) => props.theme.palette.brand};
  text-transform: uppercase;
  margin: 0;
`;

const ConvoFlowClose = styled(Image)`
  position: absolute;
  top: 1rem;
  right: 1rem;
  cursor: pointer;
`;

/* TODO: move this to a common component so it can be reused */
const Spacer = styled.div`
  height: 2rem;
`;

export default withWallet(AMMAltars);
