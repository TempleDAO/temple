import React from 'react';
import styled from 'styled-components';
import sunImage from '../../public/images/sun-art.svg';
import Image from 'next/image';

interface LoaderProps {
  iconSize?: 32 | 48 | 72;
}

const Loader = ({iconSize = 32}: LoaderProps) => {
  return <LoaderStyled src={sunImage} alt={'loading spinner'} width={iconSize} height={iconSize} />
}

const LoaderStyled = styled(Image)`
  animation: ${(props) => props.theme.animations.loading};
`;

export default Loader
