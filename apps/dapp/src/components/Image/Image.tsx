import styled from 'styled-components';

export interface ImageProps {
  src: string;
  alt: string;
  width?: number;
  height?: number;
  fit?: string;
  fillContainer?: boolean;
  objectPosition?: string;
  onClick?: Function; // eslint-disable-line
}

const Image = styled.img.attrs(({ src, alt }: ImageProps) => ({
  src,
  alt,
}))`
  ${(props: ImageProps) => props.width && `width: ${props.width}px;`}
  ${(props: ImageProps) => props.height && `height: ${props.height}px;`}

  ${(props: ImageProps) =>
    props.objectPosition && `object-position: ${props.objectPosition};`}

  ${(props: ImageProps) => props.fit && `object-fit: ${props.fit};`}
  ${(props: ImageProps) => props.fillContainer && `width: 100%; height: 100%;`}
`;

export default Image;
