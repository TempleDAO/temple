// This is the "golden pizza pie" glow that is under the selected button's text

import React from 'react';
import { useRotationAngle } from '../useRotationAngle';

import { VaultPage } from '../types';

type Props = {
  selected?: VaultPage;
};

export const SelectedGlow = ({ selected }: Props) => {
  const [angle, prevAngle, duration, ref] = useRotationAngle(selected);

  const transform = `rotate(${angle} 500 500)`;
  return (
    <g id="vault-selection-indicator" transform={transform}>
      <animateTransform
        ref={ref}
        attributeName="transform"
        attributeType="XML"
        type="rotate"
        from={`${prevAngle} 500 500`}
        to={`${angle} 500 500`}
        dur={`${duration}ms`}
        repeatCount="1"
        calcMode="spline"
        keySplines=" .4,0, .58,1"
      />

      <path
        id="vault-selected-indicator-lines"
        d="M636.713 91.983a1.543 1.543 0 0 0-2.935-.957L501.783 496.178 369.788 91.027a1.543 1.543 0 1 0-2.934.956L500.16 501.16l-.175.537a1.543 1.543 0 0 0 1.798 1.986 1.543 1.543 0 0 0 1.798-1.986l-.175-.537L636.713 91.983Z"
        fill="url(#paint10_linear_4015_16261)"
      />
      <path
        id="vault-selected-indicator-glow"
        d="M364.128 78.66a440.67 440.67 0 0 1 275.84 1.053L500.45 500.718 364.128 78.661Z"
        fill="url(#paint11_linear_4015_16261)"
      />
    </g>
  );
};
