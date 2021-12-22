import styled from 'styled-components';
import Image, { ImageProps } from 'components/Image/Image';
import triangle from 'assets/images/triangle.svg';

type BackButtonProps = ImageProps;

const BackButton = styled(Image).attrs(() => ({
  src: triangle,
}))<BackButtonProps>`
  position: absolute;
  bottom: 1rem;
  height: 40px;
  width: 40px;
  left: calc(50% - 20px);
  cursor: pointer;
  filter: brightness(90%);
  &:hover {
    filter: brightness(110%);
  }
`;

export default BackButton;
