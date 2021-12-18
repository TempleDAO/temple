import styled from 'styled-components';
import Image, { ImageProps } from 'components/Image/Image';
import triangle from 'assets/images/triangle.svg';

type BackButtonProps = ImageProps;

const BackButton = styled(Image).attrs(() => ({
  src: triangle,
}))<BackButtonProps>`
  position: absolute;
  bottom: 1rem;
  height: 30px;
  width: 30px;
  left: calc(50% - 15px);
  cursor: pointer;
  filter: brightness(90%);
  &:hover {
    filter: brightness(110%);
  }
`;

export default BackButton;
