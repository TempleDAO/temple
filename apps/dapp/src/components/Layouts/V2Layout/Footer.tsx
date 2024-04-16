import { Link } from 'react-router-dom';
import styled from 'styled-components';

import Image from '../../Image/Image';

import socialDiscordIcon from 'assets/images/social-discord.png';
import socialDocsIcon from 'assets/images/social-docs.png';
import socialMediumIcon from 'assets/images/social-medium.png';
import socialTelegramIcon from 'assets/images/social-telegram.png';
import socialTwitterIcon from 'assets/images/social-twitter.png';
import footerTexture from 'assets/images/newui-images/footerTexture.svg';

const Footer: React.FC = () => {
  const FooterContent = [
    {
      header: 'Community',
      links: [
        {
          text: 'Discord',
          image: socialDiscordIcon,
          link: 'https://discord.gg/templedao',
        },
        {
          text: 'Twitter',
          image: socialTwitterIcon,
          link: 'https://twitter.com/templedao',
        },
        {
          text: 'Telegram',
          image: socialTelegramIcon,
          link: 'https://t.me/templedao',
        },
      ],
    },
    {
      header: 'Resources',
      links: [
        {
          text: 'Docs',
          image: socialDocsIcon,
          link: 'https://docs.templedao.link/',
        },
        {
          text: 'Medium',
          image: socialMediumIcon,
          link: 'https://templedao.medium.com/',
        },
      ],
    },
  ];
  return (
    <FooterContainer>
      <LinkRow>
        {FooterContent.map((col, i) => (
          <Links key={i}>
            <h4>{col.header}</h4>
            <ul>
              {col.links.map((link, j) => (
                <li key={j}>
                  <a href={link.link} target="_blank" rel="noreferrer">
                    <FooterImage src={link.image} alt={link.text} />
                    <strong>{link.text}</strong>
                  </a>
                </li>
              ))}
            </ul>
          </Links>
        ))}
        <Links>
          <h4>Links</h4>
          <ul>
            <li>
              <Link to="/disclaimer">Disclaimer</Link>
            </li>
          </ul>
        </Links>
      </LinkRow>
      <CopyrightRow>
        © {new Date().getFullYear()} TempleDAO. All rights reserved.
      </CopyrightRow>
    </FooterContainer>
  );
};

export default Footer;

// Footer
const FooterContainer = styled.div`
  width: 100%;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  background-image: url('${footerTexture}');
  background-size: cover;
  border-top: 3px solid ${({ theme }) => theme.palette.brandDarker};
`;

const LinkRow = styled.div`
  display: flex;
  flex-direction: row;
  justify-content: space-evenly;
  align-items: flex-start;
  max-width: 1000px;
  width: 100%;
  gap: 2rem;
  padding: 1rem;

  h4 {
    margin-top: 2rem;
    margin-bottom: 1rem;
    @media (max-width: 768px) {
      font-size: 1.25rem;
      margin: 0.5rem 0;
    }
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
        @media (max-width: 768px) {
          margin-left: 0;
        }
      }
    }
  }

  li + li {
    margin-top: 1rem;
  }
`;

const Links = styled.div`
  display: flex;
  flex-direction: column;
`;

const FooterImage = styled(Image)`
  height: 24px;
  width: 24px;

  @media (max-width: 768px) {
    display: none;
  }
`;

const CopyrightRow = styled.div`
  height: 20px;
  padding: 30px;
  font-size: 14px;
  letter-spacing: 0.095em;
  color: ${({ theme }) => theme.palette.brand};
`;
