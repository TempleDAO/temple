import Image from 'next/image';
import Link from 'next/link';
import React from 'react';
import styled, { css } from 'styled-components';
import { Button } from '../components/Button/Button';
import { Flex } from '../components/Layout/Flex';
import { useWallet } from '../providers/WalletProvider';
import cashImage from '../public/images/cash.svg';
import circleBgImage from '../public/images/circle-bg.svg';
import earnTradingFeeImage from '../public/images/earn-trading-fee.svg';
import eyeImage from '../public/images/eye.svg';
import gateImage from '../public/images/gate.svg';
import lockImage from '../public/images/lock.svg';
import planetsImage from '../public/images/planets.svg';
import receiveTokenImage from '../public/images/receive-token.svg';
import sunImage from '../public/images/sun-art.svg';
import sunsetImage from '../public/images/sunset.svg';
import tagImage from '../public/images/tag.svg';
import { formatMillions, formatNumber } from '../utils/formatter';

const Home = () => {
  const { templeApy, exchangeRate, treasury } = useWallet();

  return (
      <>
        <Flex layout={{
          kind: 'container',
          direction: 'row',
        }}>
          <Flex layout={{
            kind: 'item',
            direction: 'column',
            justifyContent: 'center',
            col: 'fullwidth',
            colTablet: 'half',
          }}>
            <h1>Earn Stable Gains</h1>
            <h4>Sleep easy staking in the Temple</h4>
            <br/>
            <br/>
            <Flex layout={{
              kind: 'container',
            }}>
              <Flex layout={{
                kind: 'item',
                col: 'half',
              }}>
                <Link href={'/rituals'} passHref>
                  <Button label={'enter temple'} isUppercase showArrow isSmall/>
                </Link>
              </Flex>
              <Flex layout={{
                kind: 'item',
                col: 'half',
                alignItems: 'center',
              }}>
                <a href={'https://templedao.medium.com'} target={'_blank'} rel={'noreferrer'}>LEARN MORE</a>
              </Flex>
            </Flex>
            <br/>
            <br/>
            <br/>
            <Flex layout={{
              kind: 'container',
              direction: 'row',
            }}>
              <Flex layout={{
                kind: 'item',
                direction: 'column',
                col: 'third',
                alignItems: 'flex-start'
              }}>
                <Image src={cashImage} alt={'temple price'} height={36} width={36}/>
                <h3>${formatNumber(1 / exchangeRate)}</h3>
                <strong>$TEMPLE</strong>
              </Flex>
              <Flex layout={{
                kind: 'item',
                direction: 'column',
                col: 'third',
                alignItems: 'flex-start'
              }}>
                <Image src={lockImage} alt={'temple price'} height={36} width={36}/>
                <h3>{formatNumber(templeApy)}%</h3>
                <strong className={'color-brand'}>APY</strong>
              </Flex>
              <Flex layout={{
                kind: 'item',
                direction: 'column',
                col: 'third',
                alignItems: 'flex-start'
              }}>
                <Image src={tagImage} alt={'temple price'} height={36} width={36}/>
                <h3>${formatMillions(treasury)}</h3>
                <strong className={'color-brand'}>Treasury</strong>
              </Flex>
            </Flex>
          </Flex>
          <Flex layout={{
            kind: 'item',
            justifyContent: 'center',
            alignItems: 'center',
            col: 'half',
            hidden: true,
            hiddenTablet: false,
          }}>
            <TempleDaoSun>
              <Image src={sunImage} alt={'Temple DAO'}/>
            </TempleDaoSun>
            <Image src={gateImage} alt={'Temple DAO'}/>
          </Flex>
        </Flex>

        <section>
          <h2 className={'align-text-center'}>Temple Offerings</h2>
          <Flex layout={{
            kind: 'container',
            direction: 'row',
            canWrap: true,
            canWrapTablet: false,
          }}>
            <Flex layout={{
              kind: 'item',
              col: 'fullwidth',
              colTablet: 'half',
              direction: 'column',
              alignItems: 'center',
            }}>
              <Image src={receiveTokenImage} alt={'Receive Tokens'} height={275} width={275}/>
              <h3 className={'align-text-center'}>Stake <span className={'color-light'}>$TEMPLE</span> to play
                <br/>
                the most innovative
                <br/>
                long-term game in defi</h3>
            </Flex>
            <Flex layout={{
              kind: 'item',
              col: 'fullwidth',
              colTablet: 'half',
              direction: 'column',
              alignItems: 'center',
            }}>
              <Image src={earnTradingFeeImage} alt={'Earn Trading Fee'} height={275} width={275}/>
              <h3 className={'align-text-center'}>Stake <span className={'color-light'}>any asset</span> to <br/>automate
                and stabilise<br/><span className={'color-light'}>-
                coming thoon -</span></h3>
            </Flex>
          </Flex>
        </section>
        <section>
          <Flex layout={{
            kind: 'container',
            direction: 'row',
          }}>
            <Flex layout={{
              kind: 'item',
              direction: 'column',
              justifyContent: 'center'
            }}>
              <h2>Principled</h2>
              <p>TempleDAO is designed on strong principles: building the Temple for the long-term, community first and
                fairly in all aspects, and prioritising stable wealth creation. Our innovative mechanics including safe
                minting, intrinsic value backed rewards, safe harvest, price defence incentives, and exit queue can be
                explored in our <a href={'https://templedao.medium.com'} target={'_blank'} rel={'noreferrer'}>Medium
                  posts</a>.</p>
              <CircleBgWrapper>
                <Image src={circleBgImage} alt={''} aria-hidden={true} height={322} width={322} layout={'responsive'}/>
              </CircleBgWrapper>
            </Flex>
            <Flex layout={{
              kind: 'item',
              justifyContent: 'flex-end',
            }}>
              <Image src={sunsetImage} alt={'Earn Trading Fee'} height={450} width={450}/>
            </Flex>
          </Flex>
          <Flex layout={{
            kind: 'container',
            direction: 'row',
          }}>
            <Flex layout={{
              kind: 'item',
            }}>
              <Image src={eyeImage} alt={'Earn Trading Fee'} height={450} width={450}/>
            </Flex>
            <Flex layout={{
              kind: 'item',
              direction: 'column',
              justifyContent: 'center'
            }}>
              <h2>Ritualed</h2>
              <p>We reward those who help the Temple: no special deals for outsiders. The protocol is designed to reward
                the community, and those who give most to the Temple. Participate in RITUALS to earn incense and access
                special offers. The first step is
                <a href={'https://discord.gg/templedao'} target={'_blank'}
                   rel={'noreferrer'}> joining Discord</a> and completing the !verify
                ritual. Good luck. </p>
              <CircleBgWrapper rightAlign>
                <Image src={circleBgImage} alt={''} aria-hidden={true} height={322} width={322}/>
              </CircleBgWrapper>
            </Flex>
          </Flex>
          <Flex layout={{
            kind: 'container',
            direction: 'row',
          }}>
            <Flex layout={{
              kind: 'item',
              direction: 'column',
              justifyContent: 'center',
            }}>
              <h2>Ascension</h2>
              <p>The Templar’s end goal is ASCENSION: when the intrinsic value of your tokens is more than your purchase
                price, you have ascended. No price risk, your tokens have multiplied, you are a God. The Temple is
                designed for stable, long-term wealth creation, where the intrinsic value of your holdings increases
                steadily and only goes up. </p>
              <CircleBgWrapper>
                <Image src={circleBgImage} alt={''} aria-hidden={true} height={322} width={322}/>
              </CircleBgWrapper>
            </Flex>
            <Flex layout={{
              kind: 'item',
              justifyContent: 'flex-end',
            }}>
              <Image src={planetsImage} alt={'Earn Trading Fee'} height={450} width={450}/>
            </Flex>
          </Flex>
        </section>
      </>
  );
};

const TempleDaoSun = styled.div`
  position: absolute;
  z-index: ${(props) => props.theme.zIndexes.up};
  transform: translateY(-48%);

  img {
    animation: ${(props) => props.theme.animations.spin};
  }
`;

interface CircleBgWrapperProps {
  rightAlign?: boolean;
}

const CircleBgWrapper = styled.div<CircleBgWrapperProps>`
  position: absolute;
  transform: translateX(-50%);

  ${(props) => props.rightAlign && css`
    right: 0;
    transform: translateX(50%);

  `}
`;

export default Home;
