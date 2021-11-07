import Image from 'next/image';
import Link from 'next/link';
import React from 'react';
import styled from 'styled-components';
import { Flex } from '../Layout/Flex';


export const Footer = () => {
  return (
      <FooterStyled>
        <FooterContainer>
          <Flex layout={{
            kind: 'container',
            direction: 'row',

            canWrap: true,
            canWrapDesktop: false,
          }}>
            <Flex layout={{
              kind: 'container',
              canWrap: true,
              canWrapTablet: false,
            }}>
              <Flex layout={{
                kind: 'item',
                direction: 'column',
                colTablet: 'three-quarter',
              }}>
                <h3 className={'margin-remove'}>TempleDAO</h3>
                <br/>
                <p>In a world of volatility and stress, the Temple of long term wealth creation is where disciples come
                  to
                  stake, sleep easy, and chill.
                </p>
                <br/>
                <br/>
                <strong>
                  &copy; {new Date().getFullYear()} TempleDAO. All rights reserved.
                </strong>
              </Flex>
            </Flex>
            <Flex layout={{
              kind: 'container',
            }}>
              <Flex layout={{
                kind: 'item',
                direction: 'column',
                colTablet: 'third',
              }}>
                <h4>Community</h4>
                <ul>
                  <li>
                    {/* TODO: add no refere for SEO  */}
                    <Link href={'https://discord.gg/templedao'}>
                      <a target={'_blank'}>
                        <Image src={'/images/social-discord.png'} alt={''} width={24} height={24}/>
                        <strong>Discord</strong>
                      </a>
                    </Link>
                  </li>
                  <li>
                    <Link href={'https://twitter.com/templedao'}>
                      <a target={'_blank'}>
                        <Image src={'/images/social-twitter.png'} alt={''} width={24} height={24}/>
                        <strong>Twitter</strong>
                      </a>
                    </Link>
                  </li>
                  <li>
                    <Link href={'https://t.me/TempleDAOcommunity'}>
                      <a target={'_blank'}>
                        <Image src={'/images/social-telegram.png'} alt={''} width={24} height={24}/>
                        <strong>Telegram</strong>
                      </a>
                    </Link>
                  </li>
                </ul>
              </Flex>
              <Flex layout={{
                kind: 'item',
                direction: 'column',
                colTablet: 'third',
              }}>
                <h4>Resources</h4>
                <ul>
                  {/*<li>*/}
                  {/*  <Link href={'https://docs.templedao.link/'}>*/}
                  {/*    <a target={'_blank'}>*/}
                  {/*      <Image src={'/images/social-docs.png'} alt={''} width={24} height={24}/>*/}
                  {/*      <strong>Docs</strong>*/}
                  {/*    </a>*/}
                  {/*  </Link>*/}
                  {/*</li>*/}
                  <li>
                    <Link href={'https://templedao.medium.com/'}>
                      <a target={'_blank'}>
                        <Image src={'/images/social-medium.png'} alt={''} width={24} height={24}/>
                        <strong>Medium</strong>
                      </a>
                    </Link>
                  </li>
                  <li>
                    <Link href={'https://docs.templedao.link/'}>
                      <a target={'_blank'}>
                        <strong>GitBooks</strong>
                      </a>
                    </Link>
                  </li>
                  <li>
                    <Link href={'mailto:templedao@protonmail.com'}>
                      <a>
                        <Image src={'/images/social-message.png'} alt={''} width={24} height={24}/>
                        <strong>Contact Us</strong>
                      </a>
                    </Link>
                  </li>
                </ul>
              </Flex>
              <Flex layout={{
                kind: 'item',
                direction: 'column',
                colTablet: 'third',
              }}>
                <h4>Links</h4>
                <Link href={'/disclaimer'}>
                  <a><strong>Disclaimer</strong>
                  </a>
                </Link>
              </Flex>
            </Flex>
          </Flex>
        </FooterContainer>
      </FooterStyled>
  );
};

const FooterStyled = styled.footer`
  padding: 1.75rem /* 28/16 */;
  margin-top: 2rem;
  background: url("/images/footer-bg.png");

`;

const FooterContainer = styled.div`
  max-width: ${(props) => props.theme.metrics.desktop.maxWidth};
  margin: 0 auto;
  padding: 0 16px;

  h4 {
    margin-top: 0;
  }

  ul {
    margin: 0;
    padding: 0;
  }
  
  li {
    list-style-type: none;

    a {
      display: flex;
      align-items: center;

      strong {
        margin-left: 0.75rem;
      }
    }
  }

  li + li {
    margin-top: 1rem;
  }
`;
