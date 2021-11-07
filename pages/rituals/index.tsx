import Image from 'next/image';
import { useRouter } from 'next/router';
import React, { ReactNode, RefObject, useEffect, useRef, useState } from 'react';
import Countdown from 'react-countdown';
// @ts-ignore no @types for this package
import Typical from 'react-typical';
import styled, { css } from 'styled-components';
import { Apy } from '../../components/Apy/Apy';
import { Button } from '../../components/Button/Button';
import Card from '../../components/Card/Card';
import { Input } from '../../components/Input/Input';
import { Flex } from '../../components/Layout/Flex';
import Loader from '../../components/Loader/Loader';
import { Tab, Tabs } from '../../components/Tabs/Tabs';
import withWallet from '../../hoc/withWallet';
import { RitualKind, RitualStatus, useWallet } from '../../providers/WalletProvider';
import BuyImage from '../../public/images/buy-art.svg';
import cashImage from '../../public/images/cash.svg';
import checkImage from '../../public/images/check.svg';
import crossImage from '../../public/images/cross.svg';
import earlyEpochImage from '../../public/images/early-epoch.webp';
import lockImage from '../../public/images/lock.svg';
import tagImage from '../../public/images/tag.svg';
import { toAtto } from '../../utils/bigNumber';
import { formatMillions, formatNumber } from '../../utils/formatter';

const templePart1Video = require('../../public/videos/templedao-part1.mp4');
const templePart2Video = require('../../public/videos/templedao-part2.mp4');

export const STABLE_COIN_SYMBOL = '$FRAX';
export const RITUAL_ICON_SIZE = 48;

const Rituals = () => {
  // temple amount in the user wallet
  const [templeWalletAmount, setTempleWalletAmount] = useState<number>(0);
  // temple amount from user input in the UI
  const [templeAmount, setTempleAmount] = useState<number | undefined>(0);
  // crypto(FRAX,...) amount in the user wallet
  const [cryptoWalletAmount, setCryptoWalletAmount] = useState<number>(0);
  // crypto(FRAX,...) amount from user input in the UI
  const [cryptoAmount, setCryptoAmount] = useState<number | undefined>(0);
  // holds the value for the SandalWood Verify Token
  const [sandalWoodToken, setSandalWoodToken] = useState('');
  // todo
  const [verifying, setVerifying] = useState(false);

  const [videoHasEnded, setVideoHasEnded] = useState<boolean>(false);


  const router = useRouter();
  /** we user this step to help debug the different ritual steps {@link renderRitualStep} */
  const { step } = router.query;

  const videoRef = useRef<RefObject<HTMLVideoElement>>();
  const {
    balance,
    exchangeRate,
    allocation,
    templeApy,
    treasury,
    updateWallet,
    ritual,
    increaseAllowanceForRitual,
    isConnected,
    currentEpoch,
    clearRitual,
    isLoading,
    ocTemplar,
    verifyQuest,
  } = useWallet();

  const { amount: allocationAmount, startEpoch } = allocation;

  useEffect(() => {
    if (balance) {
      setCryptoWalletAmount(balance.stableCoin);
      setTempleWalletAmount(balance.temple);
      // we set the initial value of the cryptoInput to the lowest value btw the user balance and the max Allowed
      const allocationAmountAllowed = Math.min(balance.stableCoin, allocationAmount);
      setCryptoAmount(allocationAmountAllowed);
      setTempleAmount(allocationAmountAllowed * exchangeRate);
    } else {
      updateWallet();
    }
  }, [balance, exchangeRate, allocationAmount]);

  useEffect(() => {
    const swapVideoForRitual = () => {
      setTimeout(() => {
        setVideoHasEnded(true);
      }, 2500);
    };

    if (videoRef && videoRef.current) {
      const videoRefCurrent = videoRef.current;
      // @ts-ignore
      videoRef.current?.addEventListener('ended', swapVideoForRitual, false);

      return () => {
        // @ts-ignore
        videoRef.current?.removeEventListener('ended', swapVideoForRitual, false);
      };
    }
  });

  const handleBuyAndStake = async () => {
    try {
      if (cryptoAmount) {
        await increaseAllowanceForRitual(toAtto(cryptoAmount), RitualKind.OFFERING_STAKING);
      }
    } catch (e) {
      console.info(e);
    }
  };

  const handleUpdateBuyTemple = (event: React.ChangeEvent<HTMLInputElement>) => {
    let x = +event.target.value > 0 ? +event.target.value : undefined;
    setTempleAmount(x);

    if (x) {
      setCryptoAmount(x / exchangeRate);
    } else {
      setCryptoAmount(x);
    }
  };

  const handleSandalwoodVerify = async () => {
    setVerifying(true);
    await verifyQuest(sandalWoodToken, RitualKind.VERIFYING);
  };

  const handleUpdateCrypto = (event: React.ChangeEvent<HTMLInputElement>) => {
    let x = +event.target.value > 0 ? +event.target.value : undefined;
    setCryptoAmount(x);

    if (x) {
      setTempleAmount(x * exchangeRate);
    } else {
      setTempleAmount(x);
    }
  };

  const getExpectedBalance = (type: 'temple' | 'crypto') => {
    switch (type) {
      case 'temple':
        return formatNumber(templeWalletAmount);
      case 'crypto':
        return formatNumber(cryptoWalletAmount);
      default:
        return 0;
    }
  };

  const getNotVerifiedTab = (): Array<Tab> => {
    return [
      {
        label: 'Welcome Templar',
        disabledMessage: !isConnected ? 'Connect wallet to participate in ritual' : undefined,
        content: <Card
            flipped={verifying}
            backContent={renderActivity()}
            frontContent={<>
              <p className={'align-text-center'}>You must use the same address the you used in <a href={'https://echoingwhispers.link/'} >echoingwhispers.link</a></p>
              <br/>
              <Input hint={`Sandalwood Incense`}
                     type={'textarea'}
                     onChange={(e) => setSandalWoodToken(e.target.value)}
              />
              <br/>
              <Button label={'!verify'} onClick={handleSandalwoodVerify}/>
            </>}
        />
      },

    ];
  };

  const getTabs = (): Array<Tab> => {
    return [
      {
        label: 'Opening Ceremony',
        disabledMessage: !isConnected ? 'Connect wallet to participate in ritual' : undefined,
        content: <Card
            flipped={ritual.has(RitualKind.OFFERING_STAKING)}
            backContent={renderActivity()}
            frontContent={<>
              <p>Total sacrificable {STABLE_COIN_SYMBOL} is <strong
                  className={'color-brand'}>30 000</strong>, welcome
                Templar.</p>
              <Input hint={`Balance: ${getExpectedBalance('crypto')}`}
                     crypto={{ kind: 'value', value: STABLE_COIN_SYMBOL }}
                     type={'number'}
                     max={allocationAmount}
                     min={0}
                     value={cryptoAmount}
                     onChange={handleUpdateCrypto}
                     placeholder={'0.00'}
              />
              <Input hint={`Balance: ${getExpectedBalance('temple')}`}
                     crypto={{ kind: 'value', value: '$TEMPLE' }}
                     placeholder={'0.00'}
                     value={templeAmount}
                     type={'number'}
                     min={0}
                     max={allocationAmount}
                     onChange={handleUpdateBuyTemple}
              />
              <Button label={'Make Offering and Stake'} onClick={handleBuyAndStake}/>
              <p>
                Staked <strong className={'color-brand'}>$TEMPLE</strong> will be locked for 6 weeks.
              </p>
            </>}
        />
      },

    ];
  };

  const renderActivity = () => {
    const renderRitualStatus = (status: RitualStatus): ReactNode => {
      switch (status) {
        case RitualStatus.NO_STATUS:
          return null;
        case RitualStatus.COMPLETED:
          return <Image src={checkImage} width={RITUAL_ICON_SIZE} height={RITUAL_ICON_SIZE} alt={'ritual completed'}/>;
        case RitualStatus.PROCESSING:
          return <Loader iconSize={RITUAL_ICON_SIZE}/>;
        case RitualStatus.FAILED:
          return <Image src={crossImage} width={RITUAL_ICON_SIZE} height={RITUAL_ICON_SIZE} alt={'ritual failed'}/>;
      }
    };

    if (ritual.has(RitualKind.OFFERING_STAKING)) {
      const offeringStakingRitual = ritual.get(RitualKind.OFFERING_STAKING);
      if (offeringStakingRitual) {
        const { completedBalanceApproval, completedTransaction, ritualMessage } = offeringStakingRitual;
        return (<>
          <RitualCheck className={'flex flex-v-center'}>
            <RitualCheckImageWrapper>{renderRitualStatus(completedBalanceApproval)}</RitualCheckImageWrapper>
            Approve <span className={'color-light'}>&nbsp;{STABLE_COIN_SYMBOL}&nbsp;</span> for Sacrifice
          </RitualCheck>
          <RitualCheck className={'flex flex-v-center'}>
            <RitualCheckImageWrapper>{renderRitualStatus(completedTransaction)}</RitualCheckImageWrapper>
            Sacrifice & Burn Incense
          </RitualCheck>
          {ritualMessage && <Button label={ritualMessage} onClick={() => {
            clearRitual(RitualKind.OFFERING_STAKING);
          }}/>}
        </>);
      }
    }

    if (ritual.has(RitualKind.VERIFYING)) {
      const verificationRitual = ritual.get(RitualKind.VERIFYING);
      if (verificationRitual) {
        const { verifyingTransaction, ritualMessage } = verificationRitual;
        return (<>
          <RitualCheck className={'flex flex-v-center'}>
            <RitualCheckImageWrapper>{renderRitualStatus(verifyingTransaction)}</RitualCheckImageWrapper>
            Verifying Sandalwood
          </RitualCheck>
          {ritualMessage && <Button label={ritualMessage} onClick={() => {
            clearRitual(RitualKind.VERIFYING);
            setVerifying(false);
            updateWallet();
          }}/>}
        </>);
      }
    }
  };


  const renderRitualStep = () => {

    if (isLoading) {
      return <Flex layout={{
        kind: 'container'
      }}>
        <Flex layout={{
          kind: 'item',
          col: 'fullwidth',
          justifyContent: 'center',
        }}>
          <Loader iconSize={72}/>
        </Flex>
      </Flex>;
    }

    // Templar is not verified
    if (step === '1' || step === undefined && !ocTemplar.isVerified) {
      return (<>
        <Flex layout={{
          kind: 'container'
        }}>
          <Apy cryptoName={'$TEMPLE'} value={`$${formatNumber(1 / exchangeRate)}`} imageData={{
            imageUrl: cashImage,
            alt: ''
          }}/>
          <Apy cryptoName={'APY'} value={`${formatNumber(templeApy)} %`} imageData={{
            imageUrl: tagImage,
            alt: ''
          }}/>
          <Apy cryptoName={'Treasury'} value={`$${formatMillions(treasury)}`} imageData={{
            imageUrl: lockImage,
            alt: ''
          }}/>
        </Flex>
        <Flex layout={{
          kind: 'container',
          canWrap: true,
          canWrapTablet: false,
        }}>
          <Flex layout={{
            kind: 'item',
            col: 'fullwidth',
            colTablet: 'half',
          }}>
            <Tabs tabs={getNotVerifiedTab()} onChange={() => {
            }}/>
          </Flex>
          <Flex layout={{
            kind: 'item',
            col: 'fullwidth',
            colTablet: 'half',
            alignItems: 'flex-start',
          }}>
            <Image src={BuyImage} alt={'Buy art'}/>
          </Flex>
        </Flex>
      </>);
    }

    // User has allocation and its time to make their offerings
    if (step === '3' || step === undefined && allocationAmount > 0 && startEpoch && currentEpoch >= startEpoch) {
      return (
          <>
            {/* Only show video if the user has not yet burn any incense */}
            {videoHasEnded || templeWalletAmount > 0 || step === '3' ?
                <>
                  <Flex layout={{
                    kind: 'container'
                  }}>
                    <Apy cryptoName={'$TEMPLE'} value={`$${formatNumber(1 / exchangeRate)}`} imageData={{
                      imageUrl: cashImage,
                      alt: ''
                    }}/>
                    <Apy cryptoName={'APY'} value={`${formatNumber(templeApy)} %`} imageData={{
                      imageUrl: tagImage,
                      alt: ''
                    }}/>
                    <Apy cryptoName={'Treasury'} value={`$${formatMillions(treasury)}`} imageData={{
                      imageUrl: lockImage,
                      alt: ''
                    }}/>
                  </Flex>
                  <Flex layout={{
                    kind: 'container',
                    canWrap: true,
                    canWrapTablet: false,
                  }}>
                    <Flex layout={{
                      kind: 'item',
                      col: 'fullwidth',
                      colTablet: 'half',
                    }}>
                      <Tabs tabs={getTabs()} onChange={() => {
                      }}/>
                    </Flex>
                    <Flex layout={{
                      kind: 'item',
                      col: 'fullwidth',
                      colTablet: 'half',
                      alignItems: 'flex-start',
                    }}>
                      <Image src={BuyImage} alt={'Buy art'}/>
                    </Flex>
                  </Flex>
                </>
                :
                // @ts-ignore
                <video controls={false} autoPlay width={'100%'} ref={videoRef}>
                  {/* TODO: update video URL once video is hosted */}
                  <source
                      src={templePart1Video}/>
                </video>
            }
          </>
      );
    }

    // User has burned all allocation
    if (step === '4' || step === undefined && allocationAmount === 0 && templeWalletAmount > 0) {
      return <>
        <Typical
            steps={[
              'You burn your incense at the altar...', 1000,
              'You burn your incense at the altar... A sense of presence builds around you...', 500,
              'You burn your incense at the altar... A sense of presence builds around you... The air itself begins to feel more dense, rich, alive...', 1500,
              'You burn your incense at the altar... A sense of presence builds around you... The air itself begins to feel more dense, rich, alive... Your offering is accepted. Welcome to the Temple.'
            ]}
            loop={false}
            key={'typing-burned'}
            wrapper="p"
        />
        <Ritual>
          {/* TODO: Swap for video */}
          <video autoPlay width={'100%'}>
            <source src={templePart2Video}/>
          </video>
        </Ritual></>;
    }

  };

  return (
      <>
        <h1 className={'margin-remove--bottom'}>Opening Ceremony</h1>
        {renderRitualStep()}
      </>
  );
};


const Ritual = styled.div`
  position: relative;
  width: 100%;
`;

interface RitualCopyProps {
  // defaulted to left
  positionX?: 'left' | 'right';
  // defaulted to top
  positionY?: 'top' | 'bottom';
}

const RitualCopy = styled.p<RitualCopyProps>`
  position: absolute;
  max-width: 70%;
  ${(props) => props.positionX === 'right' ?
          css`
            right: 2rem;
          `
          : css`
            left: 2rem;
          `
  }

  ${(props) => props.positionY === 'bottom' ?
          css`
            bottom: 2rem;
          `
          : css`
            top: 2rem;
          `
  }
`;

const RitualCheck = styled.h4`
  position: relative;
  padding-left: ${RITUAL_ICON_SIZE + 16}px;
`;

const RitualCheckImageWrapper = styled.div`
  position: absolute;
  top: 0;
  left: 0;
  width: ${RITUAL_ICON_SIZE}px;
  height: ${RITUAL_ICON_SIZE}px;
`;

export default withWallet(Rituals);
