import styled from 'styled-components';

export interface EmbedProps {
  src: string;
  loading: string;
  minWidth?: number;
  height?: number;
}

const Embed = styled.iframe.attrs(({ src, loading = 'lazy' }: EmbedProps) => ({
  src,
  loading,
}))`
  border-radius: 5px;
  border: none;
  width: 100%;
  background: ${(props) => props.theme.palette.light};
  ${(props: EmbedProps) => props.minWidth && `min-width: ${props.minWidth}px;`}
  ${(props: EmbedProps) => props.height && `height: ${props.height}px;`}
`;

export default Embed;
