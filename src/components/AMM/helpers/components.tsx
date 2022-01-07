import styled from 'styled-components';
import Image, { ImageProps } from 'components/Image/Image';
import swapSvg from 'assets/icons/amm-arrow.svg';

export const TitleWrapper = styled.div`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  margin-bottom: 1.5rem;
`;

export const ConvoFlowTitle = styled.p`
  text-align: center;
  color: ${(props) => props.theme.palette.brand};
  text-transform: uppercase;
  margin: 0;
`;

interface SwapArrowsProps extends ImageProps {
  small?: boolean;
}

export const SwapArrows = styled(Image).attrs(() => ({
  src: swapSvg,
}))<SwapArrowsProps>`
  position: relative;
  width: 20px;

  left: calc(50% - 15px);
  cursor: pointer;
  -webkit-filter: brightness(90%);
  filter: brightness(90%);
  margin: ${({ small }) => (small ? '5' : '10')}px 0px;
  border-radius: 100%;
  z-index: 2;
  transition: 0.1s ease;

  :hover {
    filter: brightness(110%);
    transform: rotate(-180deg);
  }
`;

interface SpacerProps {
  small?: boolean;
}

export const Spacer = styled.div<SpacerProps>`
  height: ${({ small }) => (small ? '1' : '2')}rem;
`;

export const TooltipPadding = styled.div`
  margin-left: 2rem;
`;
export const ViewContainer = styled.div`
  display: flex;
  flex-direction: column;
  //width: 85%;
`;
