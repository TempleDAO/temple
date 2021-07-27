import Image from 'next/image';
import Link from 'next/link';
import React, { useState } from 'react';
import styled, { css } from 'styled-components';
import { useWallet } from '../../providers/WalletProvider';
import MenuImage from '../../public/images/menu.svg';
import { Button } from '../Button/Button';

const formatWalletAddress = (address: string | null): string | null => {
  if (address) {

    const addressLength = address.length;
    return `${address.substr(0, 4)}...${address.substr(addressLength - 4, addressLength)}`;
  }

  return null;
};

export const Header = () => {
  const { connectWallet, isConnected, wallet } = useWallet();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  return (
      <HeaderStyled>
        <NavContainer>
          <Link href={'/'} passHref>
            <a onClick={() => setIsMenuOpen(false)}>
              <h4>TempleDAO</h4>
            </a>
          </Link>
          <MenuContainer>
            <HeaderNav isOpen={isMenuOpen}>
              <ul>
                <li>
                  <Link href={'/rituals'}>
                    <a onClick={() => setIsMenuOpen(false)}>rituals</a>
                  </Link>
                </li>
                <li>
                  <Link href={'/enter'}>
                    <a onClick={() => setIsMenuOpen(false)}>enter</a>
                  </Link>
                </li>
                <li>
                  <Link href={'/exit'}>
                    <a onClick={() => setIsMenuOpen(false)}>exit</a>
                  </Link>
                </li>
              </ul>
            </HeaderNav>
            <HeaderNavOverlay onClick={() => setIsMenuOpen(false)}/>
            <WalletContainer>
              {
                isConnected
                    ? formatWalletAddress(wallet)
                    : <Button label={'connect wallet'} onClick={connectWallet} isSmall isUppercase/>
              }
            </WalletContainer>
            <MenuToggle onClick={() => setIsMenuOpen(!isMenuOpen)}>
              <Image src={MenuImage} alt={'nav menu'} width={32} height={32}/>
            </MenuToggle>
          </MenuContainer>
        </NavContainer>
      </HeaderStyled>
  );
};


const HeaderStyled = styled.header`
  position: fixed;
  z-index: ${(props) => props.theme.zIndexes.top};
  top: 0;
  left: 0;
  width: 100vw;
  height: ${(props) => props.theme.metrics.headerHeight};
  padding: 1rem;
  display: flex;
  justify-content: center;
  align-items: center;
  color: ${(props) => props.theme.palette.brand};
  background-color: ${(props) => props.theme.palette.dark};
`;

const NavContainer = styled.div`
  position: relative;
  max-width: ${(props) => props.theme.metrics.desktop.maxWidth};
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex: 1;
  height: 100%;
`;

interface HeaderNavProps {
  isOpen: boolean;
}

const HeaderNav = styled.nav<HeaderNavProps>`
  position: fixed;
  z-index: ${(props) => props.theme.zIndexes.up};
  top: 0;
  right: -100%;
  transition: right 250ms linear;
  display: flex;
  flex-direction: column;
  height: 100vh;
  width: 90vw;
  padding-top: ${(props) => props.theme.metrics.headerHeight};
  background-color: ${(props) => props.theme.palette.dark};
  box-shadow: ${(props) => props.theme.shadows.base};

  ${(props) => props.isOpen && css`
    right: 0;

    & ~ ${HeaderNavOverlay} {
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      background-color: ${(props) => props.theme.palette.dark75};
      z-index: ${(props) => props.theme.zIndexes};
    }
  `};

  @media screen and (min-width: 64rem  /* 1024/16 */
  ) {
    position: relative;
    top: initial;
    right: initial;
    height: initial;
    width: initial;
    flex-direction: row;
    padding-top: 0;
    box-shadow: none;
  }

  ul {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    list-style-type: none;
    margin: 0;
    padding: 0 2rem;


    li {
      padding: 0;
      text-transform: uppercase;
      ${(props) => props.theme.typography.meta};
      margin-bottom: 1.5rem;
      width: 100%;
      display: flex;
      text-align: center;

      a {
        width: 100%;
        padding: 1rem;
      }
    }

    @media screen and (min-width: 64rem  /* 1024/16 */
    ) {
      flex-direction: row;
      padding: 0;
      align-items: center;

      li {
        margin-bottom: 0;
        margin-right: 2rem;

        a {
          padding: 0;
          background-color: transparent;
          width: initial;
        }
      }
    }
  }
`;

const HeaderNavOverlay = styled.div`
  @media screen and (min-width: 64rem  /* 1024/16 */
  ) {
    display: none;
  }
`;

const WalletContainer = styled.span`
  text-transform: none;
  margin-right: 1rem;
`;

const MenuContainer = styled.div`
  display: flex;
`;


const MenuToggle = styled.div`
  position: relative;
  cursor: pointer;
  z-index: ${(props) => props.theme.zIndexes.top};
  display: flex;
  align-items: center;

  // hide toggle from table up
  /* TODO: refactor to reuse @tableUp */
  @media screen and (min-width: 64rem  /* 1024/16 */
  ) {
    display: none;
  }
`;

