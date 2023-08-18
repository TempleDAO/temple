import styled from 'styled-components';
import { phoneAndAbove } from 'styles/breakpoints';
import Image from '../../../Image/Image';

export const CodeBlock = styled.div`
  font-size: 16px;
  font-face: Courier New;
`;

export const Paragraph = styled.p`
  font-size: 18px;
  line-height: 1.5;
`;

export const ListContainer = styled.div`
  font-size: 18px;
  line-height: 1.5;
`;

export const Subtitle = styled.div`
  font-size: 18px;
  font-style: italic;
  color: ${(props) => props.color ?? props.theme.palette.brand};
`;

export const Title = styled.div`
  font-size: 24px;
  color: ${(props) => props.color ?? props.theme.palette.brand};
`;

export const ManualImage = styled(Image)`
  width: 100%;
  ${phoneAndAbove(`
    width: 800px;
  `)}
  padding-top: 20px;
  padding-bottom: 20px;
`;

export const ContentContainer = styled.div`
  display: flex;
  flex-direction: column;
  width: 100%;
  ${phoneAndAbove(`
    width: 800px;
  `)}
  align-items: flex-start:
`;

export const ManualContainer = styled.div`
  display: flex;
  flex-direction: column;
  padding: 10px;
  justify-content: center;
  align-items: center;
`;
