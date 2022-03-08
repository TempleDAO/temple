import { css } from 'styled-components';

export const flexCenter = css`
  display: flex;
  align-items: center;
  justify-content: center;
`;

export const buttonResets = css`
  appearance: none;
  border: none;
  cursor: pointer;
`;

interface BackgroundImageOptions {
  size?: 'contain' | 'cover';
  position?: string;
  repeat?: string;
  color?: string;
}

export const backgroundImage = (imageUrl: string, options?: BackgroundImageOptions) => css`
  background-image: url(${imageUrl});
  background-color: ${options?.color || 'transparent'};
  background-size: ${options?.size || 'contain'};
  background-position: ${options?.position || 'center center'};
  background-repeat: ${options?.repeat || 'no-repeat'};
`;
