import React from 'react';
import Image from 'components/Image/Image';
import styled from 'styled-components';
import { Link } from 'react-router-dom';
import { Flex } from 'components/Layout/Flex';
import socialDiscordIcon from 'assets/images/social-discord.png';
import socialDocsIcon from 'assets/images/social-docs.png';
import socialCodexIcon from 'assets/images/social-codex.png';
import socialMediumIcon from 'assets/images/social-medium.png';
import socialMessageIcon from 'assets/images/social-twitter.png';
import socialTelegramIcon from 'assets/images/social-telegram.png';
import socialTwitterIcon from 'assets/images/social-twitter.png';
import footerBg from 'assets/images/footer-bg.png';

export const Footer = () => {
  return (
    <FooterStyled>
      <FooterContainer>
        <Flex
          layout={{
            kind: 'container',
            direction: 'row',

            canWrap: true,
            canWrapDesktop: false,
          }}
        >
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
                direction: 'column',
                colTablet: 'three-quarter',
              }}
            >
              <h3 className={'margin-remove'}>TempleDAO</h3>
              <br />
              <p>
                In a world of volatility and stress, the Temple of long term
                wealth creation is where disciples come to stake, sleep easy,
                and chill.
              </p>
              <br />
              <br />
              <strong>
                &copy; {new Date().getFullYear()} TempleDAO. All rights
                reserved.
              </strong>
            </Flex>
          </Flex>
          <Flex
            layout={{
              kind: 'container',
            }}
          >
            <Flex
              layout={{
                kind: 'item',
                direction: 'column',
                colTablet: 'third',
              }}
            >
              <h4>Community</h4>
              <ul>
                <li>
                  {/* TODO: add no refere for SEO  */}
                  <a
                    href={'https://discord.gg/templedao'}
                    target={'_blank'}
                    rel="noreferrer"
                  >
                    <Image
                      src={socialDiscordIcon}
                      alt={''}
                      width={24}
                      height={24}
                    />
                    <strong>Discord</strong>
                  </a>
                </li>
                <li>
                  <a
                    href={'https://twitter.com/templedao'}
                    target={'_blank'}
                    rel="noreferrer"
                  >
                    <Image
                      src={socialTwitterIcon}
                      alt={''}
                      width={24}
                      height={24}
                    />
                    <strong>Twitter</strong>
                  </a>
                </li>
                <li>
                  <a
                    href={'https://t.me/TempleDAOcommunity'}
                    target={'_blank'}
                    rel="noreferrer"
                  >
                    <Image
                      src={socialTelegramIcon}
                      alt={''}
                      width={24}
                      height={24}
                    />
                    <strong>Telegram</strong>
                  </a>
                </li>
                <li>
                  <a
                    href={'https://templecodex.link'}
                    target={'_blank'}
                    rel="noreferrer"
                  >
                    <Image
                      src={socialCodexIcon}
                      alt={''}
                      width={24}
                      height={24}
                    />
                    <strong>Codex</strong>
                  </a>
                </li>
              </ul>
            </Flex>
            <Flex
              layout={{
                kind: 'item',
                direction: 'column',
                colTablet: 'third',
              }}
            >
              <h4>Resources</h4>
              <ul>
                <li>
                  <a
                    href={'https://docs.templedao.link/'}
                    target={'_blank'}
                    rel="noreferrer"
                  >
                    <Image
                      src={socialDocsIcon}
                      alt={''}
                      width={24}
                      height={24}
                    />
                    <strong>Docs</strong>
                  </a>
                </li>
                <li>
                  <a
                    href={'https://templedao.medium.com/'}
                    target={'_blank'}
                    rel="noreferrer"
                  >
                    <Image
                      src={socialMediumIcon}
                      alt={''}
                      width={24}
                      height={24}
                    />
                    <strong>Medium</strong>
                  </a>
                </li>
                <li>
                  <a href={'mailto:templedao@protonmail.com'}>
                    <Image
                      src={socialMessageIcon}
                      alt={''}
                      width={24}
                      height={24}
                    />
                    <strong>Contact Us</strong>
                  </a>
                </li>
              </ul>
            </Flex>
            <Flex
              layout={{
                kind: 'item',
                direction: 'column',
                colTablet: 'third',
              }}
            >
              <h4>Links</h4>
              <Link to={'/disclaimer'}>
                <strong>Disclaimer</strong>
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
  background: url(${footerBg});
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
