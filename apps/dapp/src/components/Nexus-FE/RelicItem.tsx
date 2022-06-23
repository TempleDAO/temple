import React, { FC, useEffect, useState, useCallback } from 'react';
import styled, { css } from 'styled-components';

interface RelicItemProps {
  label: string;
  handleClick: () => void;
}

export const RelicItem: FC<RelicItemProps> = (props) => {

  var RelicItemLogo: any
  const [img, setImg] = useState();

  useEffect(() => {
    // GET request using fetch inside useEffect React hook
    fetch('https://myst.mypinata.cloud/ipfs/QmXGQAVU26c33jMxh3K63ok5vCrfTgky91WTsBWEUXPVaX/0.png')
      .then(response => response.blob())
      .then(data => { RelicItemLogo = URL.createObjectURL(data); setImg(RelicItemLogo)})
      .then(() => console.log('here: '+RelicItemLogo));

    // empty dependency array means this effect will only run once (like componentDidMount in classes)
  }, []);

  return (
    <RelicItemBox
      onClick={props.handleClick}
    >
      <img src={img} style={{width: '60px', height: '60px'}}></img>
    </RelicItemBox>
  );

}

const RelicItemBox = styled.div<RelicItemBox>`
  position: relative;
  z-index: ${(props) => props.theme.zIndexes.max};
  width: 70px;
  max-width: 70px;
  height: 70px;
  max-height: 70px;
  display: flex;
  justify-content: center;
  align-items: center;
  margin: 5px;
  flex-grow: 1;
  cursor: pointer;
  transition: color 250ms linear, background-color 250ms linear;

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
  :hover {
    background-color: ${(props) => props.theme.palette.brand25};
  }
`;
interface RelicItemBox {
  isDisabled?: boolean;
}