import styled from 'styled-components';
import sunImage from 'assets/images/sun-art-new.svg';
import Image from 'components/Image/Image';

interface LoaderProps {
  iconSize?: 24 | 32 | 48 | 72;
}

const Loader = ({ iconSize = 32 }: LoaderProps) => {
  return (
    <LoaderStyled
      src={sunImage}
      alt={'loading spinner'}
      width={iconSize}
      height={iconSize}
    />
  );
};

const LoaderStyled = styled(Image)`
  animation: ${(props) => props.theme.animations.loading};
`;

export default Loader;
