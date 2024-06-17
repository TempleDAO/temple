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
import { phoneAndAbove } from 'styles/breakpoints';

export const Footer = () => {
  return (
    <FooterStyled>
      <FooterContainer>
        <div>
          <h3 className={'margin-remove'}>TempleDAO</h3>
          <br />
          <CopyrightStyled>
            &copy; {new Date().getFullYear()} TempleDAO. All rights reserved.
          </CopyrightStyled>
        </div>
        <FooterGrid>
          <Column>
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
          </Column>
          <Column>
            <h4>Resources</h4>
            <ul>
              <li>
                <a
                  href={'https://docs.templedao.link/'}
                  target={'_blank'}
                  rel="noreferrer"
                >
                  <Image src={socialDocsIcon} alt={''} width={24} height={24} />
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
          </Column>
          <Column>
            <h4>Links</h4>
            <Link to={'/disclaimer'}>
              <strong>Disclaimer</strong>
            </Link>
          </Column>
        </FooterGrid>
      </FooterContainer>
    </FooterStyled>
  );
};

const CopyrightStyled = styled.strong`
  color: ${(props) => props.theme.palette.brand};
`;

const FooterStyled = styled.footer`
  padding: 1.75rem /* 28/16 */;
  margin-top: 2rem;
  background: url('${footerBg}');
`;

const FooterGrid = styled.div`
  display: flex;
  flex-direction: row;
  width: 100%;
  flex-wrap: wrap;
`;

const Column = styled.div`
  display: flex;
  flex-direction: column;
  padding-right: 1rem;

  &:last-of-type {
    padding-right: 0;
  }

  width: 50%;

  ${phoneAndAbove(`
    width: calc(100% / 3);
  `)}
`;

const FooterContainer = styled.div`
  max-width: ${(props) => props.theme.metrics.desktop.maxWidth};
  margin: 0 auto;
  padding: 0 16px;

  h4 {
    margin-top: 2rem;
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
