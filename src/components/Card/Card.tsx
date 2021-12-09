import { ReactChild } from 'react';
import styled, { css } from 'styled-components';

interface CardProps {
  frontContent: ReactChild;
  backContent?: ReactChild;
  flipped: boolean;
}

const Card = ({ frontContent, backContent, flipped = false }: CardProps) => {
  return (
    <CardStyled flipped={flipped}>
      <CardFace>{frontContent}</CardFace>
      {backContent && <CardFaceBack>{backContent}</CardFaceBack>}
    </CardStyled>
  );
};

interface CardWrapperProps {
  flipped: boolean;
}

const CardStyled = styled.div<CardWrapperProps>`
  position: relative;
  display: flex;
  perspective: 62.5rem /* 1000/16 */;
  transform-style: preserve-3d;
  transition: transform 450ms;
  transform: rotateX(0deg);
  ${(props) =>
    props.flipped &&
    css`
      transform: rotateY(180deg);
    `};
`;

const CardFace = styled.div`
  min-width: 100%;
  backface-visibility: hidden;
  background-color: ${(props) => props.theme.palette.dark};
`;

const CardFaceBack = styled(CardFace)`
  transform: rotateY(180deg) translateX(100%);
`;

export default Card;
