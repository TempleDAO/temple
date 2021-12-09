import Image from 'components/Image/Image';
import useQuery from 'hooks/use-query';
import { useNavigate } from 'react-router-dom';
import React, {
  ReactNode,
  RefObject,
  useEffect,
  useRef,
  useState,
} from 'react';
// @ts-ignore no @types for this package
import styled from 'styled-components';
import { Button } from 'components/Button/Button';
import Card from 'components/Card/Card';
import { Input } from 'components/Input/Input';
import { Flex } from 'components/Layout/Flex';
import Loader from 'components/Loader/Loader';
import Metrics from 'components/Metrics/Metrics';
import { Tab, Tabs } from 'components/Tabs/Tabs';
import withWallet from 'hoc/withWallet';
import { RitualKind, RitualStatus, useWallet } from 'providers/WalletProvider';
import TempleGatesImage from 'assets/images/early-epoch.webp';
import TempleSacrificeImage from 'assets/images/no-allocation.webp';
import crossImage from 'assets/images/cross.svg';
import checkImage from 'assets/images/check.svg';
import templePart1Video from 'assets/videos/templedao-part1.mp4';
import useRefreshableTreasuryMetrics from 'hooks/use-refreshable-treasury-metrics';
import { toAtto } from 'utils/bigNumber';
import { formatNumber } from 'utils/formatter';

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
  const [activeTab, setActiveTab] = useState<string>('');
  const [guestAddress, setGuestAddress] = useState<string>('');

  const treasuryMetrics = useRefreshableTreasuryMetrics();

  const ENV_VARS = import.meta.env;

  const query = useQuery();
  /** we user this step to help debug the different ritual steps {@link renderRitualStep} */
  const step = ENV_VARS.ENV !== 'development' ? query.get('step') : null;
  const navigate = useNavigate();

  const videoRef = useRef<RefObject<HTMLVideoElement>>();
  const {
    balance,
    exchangeRate,
    allocation,
    updateWallet,
    ritual,
    increaseAllowanceForRitual,
    wallet,
    clearRitual,
    isLoading,
    ocTemplar,
    verifyQuest,
    inviteFriend,
    maxInvitesPerVerifiedUser,
  } = useWallet();

  const { amount: allocationAmount } = allocation;

  useEffect(() => {
    if (balance) {
      setCryptoWalletAmount(balance.stableCoin);
      setTempleWalletAmount(balance.temple);
      // we set the initial value of the cryptoInput to the lowest value btw the user balance and the max Allowed
      const allocationAmountAllowed = Math.min(
        balance.stableCoin,
        allocationAmount
      );
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
        videoRef.current?.removeEventListener(
          'ended',
          swapVideoForRitual,
          false
        );
      };
    }
  });

  const handleBuyAndStake = async () => {
    try {
      if (cryptoAmount) {
        await increaseAllowanceForRitual(
          toAtto(cryptoAmount),
          RitualKind.OFFERING_STAKING
        );
      }
    } catch (e) {
      console.info(e);
    }
  };

  const handleUpdateBuyTemple = (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const x = +event.target.value > 0 ? +event.target.value : undefined;
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
    const x = +event.target.value > 0 ? +event.target.value : undefined;
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
        label: 'HALT AND VERIFY SANDALWOOD',
        disabledMessage: !wallet
          ? 'Connect wallet to participate in ritual'
          : undefined,
        content: (
          <Card
            flipped={verifying}
            backContent={renderActivity()}
            frontContent={
              <>
                <p className={'align-text-center'}>
                  You must use the same address the you used in{' '}
                  <a href={'https://echoingwhispers.link/'}>
                    echoingwhispers.link
                  </a>
                </p>
                <br />
                <Input
                  hint={`Sandalwood Incense`}
                  type={'textarea'}
                  onChange={(e) => setSandalWoodToken(e.target.value)}
                />
                <br />
                <Button label={'!verify'} onClick={handleSandalwoodVerify} />
              </>
            }
          />
        ),
      },
    ];
  };

  const handleInviteGuest = async () => {
    await inviteFriend(guestAddress, RitualKind.INVITE_FRIEND);
  };

  const getTabs = (): Array<Tab> => {
    return [
      {
        label: 'sacrifice',
        disabledMessage: !wallet
          ? 'Connect wallet to participate in ritual'
          : undefined,
        content: (
          <Card
            flipped={ritual.has(RitualKind.OFFERING_STAKING)}
            backContent={renderActivity()}
            frontContent={
              <>
                {ocTemplar.isVerified && (
                  <p>
                    Total sacrificable {STABLE_COIN_SYMBOL} is{' '}
                    <strong className={'color-brand'}>
                      {allocationAmount}
                    </strong>
                    , welcome Templar.
                  </p>
                )}
                {ocTemplar.isGuest && !ocTemplar.isVerified && (
                  <>
                    <p className={'margin-remove--top'}>
                      <strong>
                        Welcome, you have received Sandalwood from someone
                        inside the Temple.
                      </strong>
                    </p>
                    <p>
                      As a favour to friends of our friends, you may sacrifice
                      up to{' '}
                      <strong className={'color-brand'}>
                        {allocationAmount} {STABLE_COIN_SYMBOL}
                      </strong>{' '}
                      at Opening Ceremony rates. You will receive an almost-as
                      high 0.9% per day yield.
                    </p>
                    <p>
                      If you would like to sacrifice more{' '}
                      <strong className={'color-brand'}>
                        {STABLE_COIN_SYMBOL}
                      </strong>
                      , or receive the full Pilgrim rate 1.0% per day yield,
                      please &nbsp;
                      <a
                        href={'https://discord.gg/templedao'}
                        target={'_blank'}
                        rel="noreferrer"
                      >
                        join Discord
                      </a>{' '}
                      and begin the Pilgrimage (note: it takes minimum 48 hours
                      to complete).
                    </p>
                    <br />
                  </>
                )}
                <Input
                  hint={`Balance: ${getExpectedBalance('crypto')}`}
                  crypto={{ kind: 'value', value: STABLE_COIN_SYMBOL }}
                  type={'number'}
                  max={allocationAmount}
                  min={0}
                  value={cryptoAmount}
                  onChange={handleUpdateCrypto}
                  placeholder={'0.00'}
                />
                <Input
                  hint={`Balance: ${getExpectedBalance('temple')}`}
                  crypto={{ kind: 'value', value: '$TEMPLE' }}
                  placeholder={'0.00'}
                  value={templeAmount}
                  type={'number'}
                  min={0}
                  max={allocationAmount}
                  onChange={handleUpdateBuyTemple}
                />
                <Button
                  label={'Make Offering and Stake'}
                  onClick={handleBuyAndStake}
                  disabled={allocationAmount === 0}
                />
                {allocationAmount === 0 && (
                  <small>You have Burned all your Sandalwood Incense</small>
                )}
                <br />
                <p className={'margin-remove--bottom'}>
                  Staked <strong className={'color-brand'}>$TEMPLE</strong> will
                  be locked for 6 weeks.
                </p>
                <br />
                {ocTemplar.isGuest && !ocTemplar.isVerified && (
                  <small>
                    Have you completed the Opening Ceremony and want to verify
                    your own Sandalwood?&nbsp;
                    <a href="rituals?step=1">Go here.</a>
                  </small>
                )}
              </>
            }
          />
        ),
      },
      {
        label: 'invite',
        disabledMessage: ocTemplar.isVerified
          ? ocTemplar.totalSacrificedStablec === 0
            ? `To invite a friend, you need to sacrifice some ${STABLE_COIN_SYMBOL}`
            : undefined
          : ocTemplar.isGuest
          ? 'To invite a friend you need to complete the Opening Ceremony'
          : undefined,
        content: (
          <Card
            flipped={ritual.has(RitualKind.INVITE_FRIEND)}
            backContent={renderActivity()}
            frontContent={
              <>
                {ocTemplar.isVerified && (
                  <>
                    <p className={'margin-remove--top'}>
                      <strong>Conditions for invitation:</strong> You are logged
                      in with your address that completed the Opening Ceremony,
                      that you have sacrificed $FRAX, that it is a valid
                      address, and that you have not used all two of your
                      invitations already.
                    </p>
                    <br />
                    <Input
                      type={'text'}
                      onChange={(e) => setGuestAddress(e.target.value)}
                      placeholder={'0x12....0a1b'}
                    />
                    <Button
                      label={'Invite friend'}
                      disabled={
                        guestAddress === '' ||
                        ocTemplar.numInvited === maxInvitesPerVerifiedUser
                      }
                      onClick={handleInviteGuest}
                    />
                    <p>
                      <strong>
                        You have invited{' '}
                        <span className={'color-brand'}>
                          {ocTemplar.numInvited}
                        </span>
                        /{maxInvitesPerVerifiedUser} Friends
                      </strong>
                    </p>
                  </>
                )}
              </>
            }
          />
        ),
      },
    ];
  };

  const renderActivity = () => {
    const renderRitualStatus = (status: RitualStatus): ReactNode => {
      switch (status) {
        case RitualStatus.NO_STATUS:
          return null;
        case RitualStatus.COMPLETED:
          return (
            <Image
              src={checkImage}
              width={RITUAL_ICON_SIZE}
              height={RITUAL_ICON_SIZE}
              alt={'ritual completed'}
            />
          );
        case RitualStatus.PROCESSING:
          return <Loader iconSize={RITUAL_ICON_SIZE} />;
        case RitualStatus.FAILED:
          return (
            <Image
              src={crossImage}
              width={RITUAL_ICON_SIZE}
              height={RITUAL_ICON_SIZE}
              alt={'ritual failed'}
            />
          );
      }
    };

    if (ritual.has(RitualKind.OFFERING_STAKING)) {
      const offeringStakingRitual = ritual.get(RitualKind.OFFERING_STAKING);
      if (offeringStakingRitual) {
        const {
          completedBalanceApproval,
          completedTransaction,
          ritualMessage,
        } = offeringStakingRitual;
        return (
          <>
            <RitualCheck className={'flex flex-v-center'}>
              <RitualCheckImageWrapper>
                {renderRitualStatus(completedBalanceApproval)}
              </RitualCheckImageWrapper>
              Approve{' '}
              <span className={'color-light'}>
                &nbsp;{STABLE_COIN_SYMBOL}&nbsp;
              </span>{' '}
              for Sacrifice
            </RitualCheck>
            <RitualCheck className={'flex flex-v-center'}>
              <RitualCheckImageWrapper>
                {renderRitualStatus(completedTransaction)}
              </RitualCheckImageWrapper>
              Sacrifice & Burn Incense
            </RitualCheck>
            {ritualMessage && (
              <Button
                label={ritualMessage}
                onClick={() => {
                  clearRitual(RitualKind.OFFERING_STAKING);
                  updateWallet();
                }}
              />
            )}
          </>
        );
      }
    }

    if (ritual.has(RitualKind.VERIFYING)) {
      const verificationRitual = ritual.get(RitualKind.VERIFYING);
      if (verificationRitual) {
        const { verifyingTransaction, ritualMessage } = verificationRitual;
        return (
          <>
            <RitualCheck className={'flex flex-v-center'}>
              <RitualCheckImageWrapper>
                {renderRitualStatus(verifyingTransaction)}
              </RitualCheckImageWrapper>
              Verifying Sandalwood
            </RitualCheck>
            {ritualMessage && (
              <Button
                label={ritualMessage}
                onClick={() => {
                  if (
                    verificationRitual.verifyingTransaction ===
                    RitualStatus.COMPLETED
                  ) {
                    // remove the ?step=[] from the query params, so user is not locked in any step after verifying.
                    navigate('/rituals', { replace: true });
                  }
                  clearRitual(RitualKind.VERIFYING);
                  setVerifying(false);
                  updateWallet();
                }}
              />
            )}
          </>
        );
      }
    }
    if (ritual.has(RitualKind.INVITE_FRIEND)) {
      const inviteFriendRitual = ritual.get(RitualKind.INVITE_FRIEND);
      if (inviteFriendRitual) {
        const { inviteFriendTransaction, ritualMessage } = inviteFriendRitual;
        return (
          <>
            <RitualCheck className={'flex flex-v-center'}>
              <RitualCheckImageWrapper>
                {renderRitualStatus(inviteFriendTransaction)}
              </RitualCheckImageWrapper>
              Inviting friend to the Temple
            </RitualCheck>
            {ritualMessage && (
              <Button
                label={ritualMessage}
                onClick={() => {
                  clearRitual(RitualKind.INVITE_FRIEND);
                  setVerifying(false);
                  updateWallet();
                }}
              />
            )}
          </>
        );
      }
    }
  };

  const renderRitualStep = () => {
    if (isLoading) {
      return (
        <Flex
          layout={{
            kind: 'container',
          }}
        >
          <Flex
            layout={{
              kind: 'item',
              col: 'fullwidth',
              justifyContent: 'center',
            }}
          >
            <Loader iconSize={72} />
          </Flex>
        </Flex>
      );
    }

    // Templar is not verified
    if (
      step === '1' ||
      (!step && !ocTemplar.isVerified && !ocTemplar.isGuest)
    ) {
      return (
        <>
          {treasuryMetrics ? (
            <Metrics treasuryMetrics={treasuryMetrics} />
          ) : null}
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
                col: 'fullwidth',
                colTablet: 'half',
              }}
            >
              <Tabs tabs={getNotVerifiedTab()} />
            </Flex>
            <Flex
              layout={{
                kind: 'item',
                col: 'fullwidth',
                colTablet: 'half',
                alignItems: 'flex-start',
              }}
            >
              <Image
                src={TempleGatesImage}
                alt={'Sandalwood  verify to enter the Temple'}
                fillContainer
              />
            </Flex>
          </Flex>
        </>
      );
    }

    // User has allocation and its time to make their offerings
    if (step === '3' || (!step && ocTemplar.isVerified) || ocTemplar.isGuest) {
      return (
        <>
          {/* Only show video if the user has not yet burn any incense */}
          {videoHasEnded || templeWalletAmount > 0 || step === '3' ? (
            <>
              {treasuryMetrics ? (
                <Metrics treasuryMetrics={treasuryMetrics} />
              ) : null}
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
                    col: 'fullwidth',
                    colTablet: 'half',
                  }}
                >
                  <Tabs tabs={getTabs()} onChange={setActiveTab} />
                </Flex>
                <Flex
                  layout={{
                    kind: 'item',
                    col: 'fullwidth',
                    colTablet: 'half',
                    alignItems: 'flex-start',
                  }}
                >
                  <Image
                    src={TempleSacrificeImage}
                    alt={'Sacrifice for the Temple'}
                    fillContainer
                  />
                </Flex>
              </Flex>
            </>
          ) : (
            <video
              controls={ENV_VARS.VITE_ENV === 'development'}
              autoPlay
              width={'100%'}
              // @ts-ignore
              ref={videoRef}
            >
              {/* TODO: update video URL once video is hosted */}
              <source src={templePart1Video} />
            </video>
          )}
        </>
      );
    }
  };

  return (
    <>
      <h1 className={'margin-remove--bottom'}>Opening Ceremony</h1>
      {renderRitualStep()}
    </>
  );
};

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
