import crossImage from 'assets/images/cross.svg';
import ClaimOGTemple from 'components/AMM/ClaimOGTemple';
import { Button } from 'components/Button/Button';
import { DataCard } from 'components/DataCard/DataCard';
import Image from 'components/Image/Image';
import { Input } from 'components/Input/Input';
import { Flex } from 'components/Layout/Flex';
import { STABLE_COIN_SYMBOL } from 'components/Pages/Rituals';
import PercentageBar from 'components/PercentageBar/PercentageBar';
import Tooltip, { TooltipIcon } from 'components/Tooltip/Tooltip';
import { BigNumber } from 'ethers';
import withWallet from 'hoc/withWallet';
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
import { getDaysToTimestamp } from 'utils/dates';
import { formatNumber } from 'utils/formatter';
import BackButton from 'components/Button/BackButton';
import MetamaskButton from 'components/Button/MetamaskButton';
import { CustomRoutingPage } from 'hooks/use-custom-spa-routing';

export enum AMMView {
  BUY = 'BUY',
  SELL = 'SELL',
  STAKE = 'STAKE',
  BTFD = 'BTFD',
  DEFEND = 'DEFEND',
  UNLOCK = 'UNLOCK OG TEMPLE',
  JOIN_QUEUE = 'JOIN QUEUE',
  WITHDRAW = 'WITHDRAW TEMPLE',
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
    exitQueueData,
    getRewardsForOGT,
    increaseAllowanceForRitual,
    lockedEntries,
    updateWallet,
    buy,
    getJoinQueueData,
    getSellQuote,
    getBuyQuote,
  } = useWallet();
  // OGT amount in the user wallet
  const [OGTWalletAmount, setOGTWalletAmount] = useState<number>(0);
  // StableCoin in the user wallet (Frax)
  const [stableCoinWalletAmount, setStableCoinWalletAmount] =
    useState<number>(0);
  const [stableCoinAmount, setStableCoinAmount] = useState<number>(0);
  // $TEMPLE in the user wallet
  const [templeWalletAmount, setTempleWalletAmount] = useState<number>(0);
  const [templeAmount, setTempleAmount] = useState<number>(0);
  const [OGTAmount, setOGTAmount] = useState<number>(0);
  const [rewards, setRewards] = useState<number>(0);
  const [activeAMMView, setActiveAMMView] = useState<AMMView | null>(view);
  // Slippage for TXN minOut
  const [slippage, setSlippage] = useState<number>(1);
  const [activeAMMView, setActiveAMMView] = useState<AMMView | null>(null);
  const [prevAMMView, setPrevAMMView] = useState<AMMView | null>(null);
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

  const handleSetActiveAMMView = (
    view: AMMView | null,
    prevView: AMMView | null = null,
    shouldUpdateData = true
  ) => {
    if (shouldUpdateData) {
      updateWallet();
    }
    setRewards(0);
    setActiveAMMView(view);
    setPrevAMMView(prevView);
  };

  const handleClaimOgTemple = async (index: number) => {
    console.info(`handleClaimOgTemple: ${index}`);
    await claimOgTemple(index);
    // fetch new LockedEntries
    updateWallet();
  };

  const handleUpdateOGT = (event: React.ChangeEvent<HTMLInputElement>) => {
    const x = +event.target.value > 0 ? +event.target.value : 0;
    setOGTAmount(x);
    void updateTempleRewards(x);
    void updateJoinQueueData(x);
  };

  const handleUpdateSlippage = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const x = +event.target.value > 0 ? +event.target.value : 0;
    setSlippage(x);
    setRewards(
      fromAtto(
        (await getBuyQuote(toAtto(stableCoinAmount), x)) ||
          BigNumber.from(0) ||
          0
      )
    );
  };

  const handleUpdateStableCoinAmount = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const x = +event.target.value > 0 ? +event.target.value : 0;
    setStableCoinAmount(x);
    console.info(`handleUpdateStableCoinAmount: ${x}`);
    /* TODO: get rewards from contract */
    setRewards(
      fromAtto(
        (await getBuyQuote(toAtto(x), slippage)) || BigNumber.from(0) || 0
      )
    );
  };

  const handleUpdateTempleAmount = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const x = +event.target.value > 0 ? +event.target.value : 0;
    setTempleAmount(x);
    setRewards(
      fromAtto((await getSellQuote(toAtto(x))) || BigNumber.from(0) || 0)
    );
  };

  const handleUnlockOGT = async () => {
    try {
      if (OGTAmount) {
        console.info(`handleUnlockOGT => ${OGTAmount}`);
        await increaseAllowanceForRitual(
          toAtto(OGTAmount),
          RitualKind.OGT_UNLOCK,
          'OGT'
        );
      }
    } catch (e) {
      console.info(e);
    }
  };

  const handleSacrificeStableCoin = async () => {
    try {
      if (stableCoinAmount) {
        console.info(`handleSacrificeStableCoin => ${stableCoinAmount}`);
        /* TODO: implement contract interaction */
        await buy(toAtto(stableCoinAmount));
      }
    } catch (e) {
      console.info(e);
    }
  };

  const handleSurrenderTemple = async () => {
    try {
      if (templeAmount) {
        await increaseAllowanceForRitual(
          toAtto(templeAmount),
          RitualKind.SURRENDER,
          'TEMPLE'
        );
      }
    } catch (e) {
      console.info(e);
    }
  };

  const handleTempleStake = async () => {
    try {
      if (templeAmount) {
        console.info(`handleSurrenderTemple => ${templeAmount}`);
      }
    } catch (e) {
      console.info(e);
    }
  };

  const renderAMMView = (): ReactNode => {
    switch (activeAMMView) {
      case AMMView.EXCHANGE_WITHDRAW:
        return (
          <>
            <ConvoFlowTitle>WHAT BRINGS YOU TO THE TEMPLE?</ConvoFlowTitle>
            <Flex
              layout={{
                kind: 'container',
                justifyContent: 'space-around',
                canWrap: true,
                canWrapTablet: false,
              }}
            >
              <Flex
                layout={{
                  kind: 'item',
                  col: 'quarter',
                  alignItems: 'center',
                  justifyContent: 'space-around',
                }}
              >
                <Button
                  label={AMMView.UNLOCK}
                  isSmall
                  isUppercase
                  onClick={() =>
                    handleSetActiveAMMView(AMMView.UNLOCK, activeAMMView)
                  }
                />
              </Flex>
              <Flex
                layout={{
                  kind: 'item',
                  col: 'quarter',
                  alignItems: 'center',
                  justifyContent: 'space-around',
                }}
              >
                <Button
                  label={AMMView.JOIN_QUEUE}
                  isSmall
                  isUppercase
                  onClick={() =>
                    handleSetActiveAMMView(AMMView.JOIN_QUEUE, activeAMMView)
                  }
                />
              </Flex>
              <Flex
                layout={{
                  kind: 'item',
                  col: 'quarter',
                  alignItems: 'center',
                  justifyContent: 'space-around',
                }}
              >
                <Button
                  label={AMMView.WITHDRAW}
                  isSmall
                  isUppercase
                  onClick={() =>
                    handleSetActiveAMMView(AMMView.WITHDRAW, activeAMMView)
                  }
                />
              </Flex>
              <Flex
                layout={{
                  kind: 'item',
                  col: 'quarter',
                  alignItems: 'center',
                  justifyContent: 'space-around',
                }}
              >
                <Button
                  label={AMMView.SELL}
                  isSmall
                  isUppercase
                  onClick={() =>
                    handleSetActiveAMMView(AMMView.SELL, activeAMMView)
                  }
                />
              </Flex>
            </Flex>
          </>
        );
      case AMMView.EXCHANGE_TRADE:
        return (
          <>
            <ConvoFlowTitle>DECLARE YOUR INTENT</ConvoFlowTitle>
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
                  alignItems: 'center',
                  justifyContent: 'space-around',
                }}
              >
                <Button
                  label={AMMView.BUY}
                  isSmall
                  isUppercase
                  onClick={() =>
                    handleSetActiveAMMView(AMMView.BUY, activeAMMView)
                  }
                />
              </Flex>
              <Flex
                layout={{
                  kind: 'item',
                  alignItems: 'center',
                  justifyContent: 'space-around',
                }}
              >
                <Button
                  label={AMMView.STAKE}
                  isSmall
                  isUppercase
                  onClick={() =>
                    handleSetActiveAMMView(AMMView.STAKE, activeAMMView)
                  }
                />
              </Flex>
              <Flex
                layout={{
                  kind: 'item',
                  alignItems: 'center',
                  justifyContent: 'space-around',
                }}
              >
                {/* TODO: get `disable` from contract */}
                <Button
                  label={AMMView.BTFD}
                  isSmall
                  isUppercase
                  onClick={() =>
                    handleSetActiveAMMView(AMMView.BTFD, activeAMMView)
                  }
                  disabled
                />
              </Flex>
            </Flex>
          </>
        );
      case AMMView.BUY:
        return (
          <>
            <ConvoFlowTitle>HOW MUCH YOU WANT TO SACRIFICE</ConvoFlowTitle>
            <Input
              hint={`Balance: ${stableCoinWalletAmount}`}
              crypto={{ kind: 'value', value: STABLE_COIN_SYMBOL }}
              type={'number'}
              max={stableCoinWalletAmount}
              min={0}
              value={stableCoinAmount}
              onChange={handleUpdateStableCoinAmount}
              placeholder={'0.00'}
            />
            <Input
              hint={`Balance: ${rewards}`}
              crypto={{ kind: 'value', value: TEMPLE_TOKEN }}
              type={'number'}
              value={rewards}
              disabled
            />
            <Flex
              layout={{
                kind: 'container',
                justifyContent: 'space-between',
              }}
            >
              <small>Slippage: {slippage}%</small>
            </Flex>
            <Input
              crypto={{ kind: 'value', value: 'Slippage' }}
              type={'number'}
              min={0}
              value={slippage}
              onChange={handleUpdateSlippage}
            />

            <br />
            <br />
            <Button
              label={`sacrifice ${STABLE_COIN_SYMBOL}`}
              isUppercase
              onClick={handleSacrificeStableCoin}
              disabled={stableCoinAmount === 0}
            />
          </>
        );
      case AMMView.SELL:
        return (
          <>
            <ConvoFlowTitle>SELECT {TEMPLE_TOKEN} TO SELL</ConvoFlowTitle>
            <Input
              hint={`Balance: ${templeWalletAmount}`}
              crypto={{ kind: 'value', value: TEMPLE_TOKEN }}
              type={'number'}
              max={templeWalletAmount}
              min={0}
              value={templeAmount}
              onChange={handleUpdateTempleAmount}
              placeholder={'0.00'}
            />
            <Input
              hint={`BALANCE: ${templeWalletAmount}`}
              crypto={{ kind: 'value', value: STABLE_COIN_SYMBOL }}
              type={'number'}
              value={formatNumber(rewards)}
              disabled
            />

            <Button
              label={`SURRENDER ${TEMPLE_TOKEN}`}
              isUppercase
              onClick={handleSurrenderTemple}
              disabled={templeAmount === 0}
            />
          </>
        );
      case AMMView.STAKE:
        return (
          <>
            <>
              <ConvoFlowTitle>SELECT {TEMPLE_TOKEN} STAKE</ConvoFlowTitle>
              <Input
                hint={`Balance: ${templeWalletAmount}`}
                crypto={{ kind: 'value', value: TEMPLE_TOKEN }}
                type={'number'}
                max={templeWalletAmount}
                min={0}
                value={templeAmount}
                onChange={handleUpdateTempleAmount}
                placeholder={'0.00'}
              />
              <DataCard
                title={`${STABLE_COIN_SYMBOL} REWARDS`}
                data={formatNumber(rewards) + ''}
              />
              <br />
              <br />
              <Button
                label={`STAKE ${TEMPLE_TOKEN}`}
                isUppercase
                onClick={handleTempleStake}
                disabled={templeAmount === 0}
              />
            </>
          </>
        );
      case AMMView.DEFEND:
        return (
          <>
            <pre>{AMMView.DEFEND}</pre>
          </>
        );
      case AMMView.UNLOCK:
        return (
          <>
            <ConvoFlowTitle>CLAIM YOUR $OG TEMPLE</ConvoFlowTitle>
            <p className={'align-text-center'}>
              $OG TEMPLE CAN BE UNLOCKED ACCORDING TO THE TIME OF STAKING
            </p>
            <br />
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
                  label={'done & chill'}
                  isSmall
                  isUppercase
                  onClick={() =>
                    handleSetActiveAMMView(AMMView.EXCHANGE_WITHDRAW)
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
                  label={'continue to exit'}
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
                    All unstaking occurs by joining an exit queue, which smooths
                    the rate at which $TEMPLE tokens can be withdrawn. This
                    supports price stability. See GitBooks for mechanics.
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
              hint={`Balance: ${OGTWalletAmount}`}
              crypto={{ kind: 'value', value: 'OGT' }}
              type={'number'}
              max={OGTWalletAmount}
              min={0}
              value={OGTAmount}
              onChange={handleUpdateOGT}
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
                  data={formatNumber(rewards) + ''}
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
                />
              </Flex>
            </Flex>
            <br />
            <Button
              label={'BURN $OG TEMPLE & JOIN QUEUE'}
              onClick={handleUnlockOGT}
              isUppercase
              disabled={OGTAmount === 0}
            />
          </>
        );
      case AMMView.WITHDRAW:
        return (
          <>
            <ConvoFlowTitle>
              YOU HAVE {exitQueueData.totalTempleOwned} {TEMPLE_TOKEN} IN QUEUE
            </ConvoFlowTitle>
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
                />
              </Flex>
              <Flex
                layout={{
                  kind: 'item',
                  col: 'third',
                }}
              >
                <DataCard
                  title={'QUEUE PROCESSED'}
                  data={`+${getDaysToTimestamp(
                    exitQueueData.claimableAt
                  )} DAYS`}
                />
              </Flex>
            </Flex>
            <br />
            <Button
              label={'claim available temple'}
              onClick={claimAvailableTemple}
              isSmall
              isUppercase
              disabled={exitQueueData.claimableTemple === 0}
            />
          </>
        );
      default:
        return null;
    }
  };

  return (
    <>
      <h1>EXCHANGE</h1>
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
          <h2 className={'margin-remove'}>Temple(TMPL)</h2>
        </Flex>
        <Flex
          layout={{
            kind: 'item',
            col: 'three-quarter',
            alignItems: 'center',
            justifyContent: 'space-around',
          }}
        >
          <Button
            label={AMMView.EXCHANGE_TRADE}
            isSmall
            isUppercase
            onClick={() =>
              handleSetActiveAMMView(AMMView.EXCHANGE_TRADE, null, false)
            }
            isActive={activeAMMView === AMMView.EXCHANGE_TRADE}
            autoWidth
          />
          <Button
            label={AMMView.EXCHANGE_WITHDRAW}
            isSmall
            isUppercase
            onClick={() =>
              handleSetActiveAMMView(AMMView.EXCHANGE_WITHDRAW, null, false)
            }
            isActive={activeAMMView === AMMView.EXCHANGE_WITHDRAW}
            autoWidth
          />
          <Button
            label={AMMView.EXCHANGE_DEFEND}
            isSmall
            isUppercase
            onClick={() =>
              handleSetActiveAMMView(AMMView.EXCHANGE_DEFEND, null, false)
            }
            isActive={activeAMMView === AMMView.EXCHANGE_DEFEND}
            autoWidth
          />
        </Flex>
      </Flex>
      <ConvoFlowOverlay isOpen={activeAMMView !== null}>
        <ConvoFlowContent>
          <ConvoFlowClose
            src={crossImage}
            alt={'Close notification'}
            width={24}
            height={24}
            onClick={() => handleSetActiveAMMView(prevAMMView, null, false)}
          />
          {renderAMMView()}
        </ConvoFlowContent>
      </ConvoFlowOverlay>
    </>
  );
};

const TitleWrapper = styled.div`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 100%;

  ${TooltipIcon} {
    margin-left: 2rem;
  }
`;

interface ConvoFlowProps {
  isOpen: boolean;
}

const ConvoFlowOverlay = styled.div<ConvoFlowProps>`
  position: fixed;
  top: 110vh;
  left: 0;
  z-index: ${(props) => props.theme.zIndexes.top};
  width: 100vw;
  height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: top 450ms ease-in-out;

  ${({ isOpen }: ConvoFlowProps) =>
    isOpen &&
    css`
      top: 0;
    `}
  :before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background-color: ${(props) => props.theme.palette.dark75};
    backdrop-filter: blur(0.1rem);
  }
`;

const ConvoFlowContent = styled.div`
  position: relative;
  z-index: 100;
  width: 100%;
  max-width: ${(props) => props.theme.metrics.desktop.maxWidth};
  background-color: ${(props) => props.theme.palette.dark};
  padding: 2rem;
  border: 0.0625rem /* 1/16 */ solid ${(props) => props.theme.palette.brand};
`;

const ConvoFlowTitle = styled.p`
  text-align: center;
  color: ${(props) => props.theme.palette.brand};
  text-transform: uppercase;
  margin-bottom: 2rem;
`;

const ConvoFlowClose = styled(Image)`
  position: absolute;
  top: 1rem;
  right: 1rem;
  cursor: pointer;
`;

export default withWallet(AMMAltars);
