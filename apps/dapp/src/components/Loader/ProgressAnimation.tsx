import React from 'react';
import styled, { css, keyframes } from 'styled-components';
import Image from 'components/Image/Image';
import sunImage from 'assets/images/sun-art-new.svg';

const sunAnimation = keyframes`
  from {
    transform: rotate(5deg);
  }

  to {
    transform: rotate(190deg);
  }
`;

const AnimationContainer = styled.div`
  position: absolute;
  width: 28rem;
  height: 12.5rem;
  margin-bottom: 11rem;
`;

const Track = styled.hr`
  position: relative;
  border: 2px dashed ${({ theme }) => theme.palette.brand};
  width: 25rem;
  height: 12.5rem;
  border-radius: 14rem 14rem 0 0;
  border-bottom: 0;
`;

type SunAnimatorProps = {
  play?: boolean;
  finished?: boolean;
};

const SunAnimator = styled.div<SunAnimatorProps>`
  position: relative;
  transform-origin: center top;
  ${({ play }: SunAnimatorProps) =>
    play &&
    css`
      animation: ${sunAnimation} 5s infinite alternate ease-in-out;
    `}

  ${({ finished }: SunAnimatorProps) =>
    finished &&
    `
  img {
    transform: translateX(25rem)
  }
  `}
`;

const Sun = ({ play, finished }: SunAnimatorProps) => (
  <SunAnimator play={play} finished={finished}>
    <Image src={sunImage} width={60} height={60} alt={'$TEMPLE'} />
  </SunAnimator>
);

export const ProgressAnimation = ({ play, finished }: SunAnimatorProps) => (
  <AnimationContainer>
    <Track />
    <Sun play={play} finished={finished} />
  </AnimationContainer>
);
