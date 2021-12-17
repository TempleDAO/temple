import styled from 'styled-components';
import Image, { ImageProps } from 'components/Image/Image';

type BackButtonProps = ImageProps & {
  width: number;
};

const BackButton = styled(Image)<BackButtonProps>`
  position: absolute;
  bottom: 0;
  left: calc(50% - ${({ width }) => width / 2}px);
  cursor: pointer;
`;

export default BackButton;
