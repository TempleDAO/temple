import styled from 'styled-components';
import Image, { ImageProps } from 'components/Image/Image';
import triangle from 'assets/images/triangle.svg';

type BackButtonProps = ImageProps & {
  width: number;
};

const BackButton = styled(Image).attrs(() => ({
  src: triangle,
}))<BackButtonProps>`
  position: absolute;
  bottom: 0;
  left: calc(50% - ${({ width }) => width / 2}px);
  cursor: pointer;
  & hover {
    filter: brightness(200%);
  }
`;

export default BackButton;
