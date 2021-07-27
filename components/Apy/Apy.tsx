import Image from 'next/image';
import React from 'react';
import styled, { css } from 'styled-components';

interface ApyProps {
  cryptoName: string,
  imageData: {
    imageUrl: StaticImageData,
    alt: string,
  },
  value: string
}

/**
 * Primary UI component for user interaction
 */
export const Apy = ({
                      cryptoName,
                      value,
                      imageData
                    }: ApyProps) => {
  const {imageUrl, alt} = imageData;
  return (
      <ApyStyled>
        <i><Image src={imageUrl} alt={alt} width={22} height={22} /></i>
        <ApyLabel>
          {value}
        </ApyLabel>
        <ApyLabel isGold>
          {cryptoName}
        </ApyLabel>
      </ApyStyled>
  );
};

interface ApyStyledProps {
  isGold?: boolean;
}

export const ApyStyled = styled.div<ApyStyledProps>`
  display: flex;
  flex-direction: column;
  position: relative;
  padding-left: 32px;
  margin: 1.25rem 0 3rem 0;

  & + & {
    margin-left: 4rem;
  }

  i {
    position: absolute;
    top: 0;
    left: 0;
    margin: 0;
    font-weight: bold;
    display: flex;
    align-items: center;
    justify-content: center;
  }
`;

const ApyLabel = styled.strong<ApyStyledProps>`
  ${(props) => props.isGold && css`
    color: ${(props) => props.theme.palette.brand}
  `};
`;
