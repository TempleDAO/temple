import { SelectedGlow } from './SelectedGlow';
import { OuterRingTickmarks } from './OuterRingTickmarks';
import { VaultPage } from '../types';

type Props = {
  selected?: VaultPage;
};

export const OuterRing = ({ selected }: Props) => {
  return (
    <g id="vault-outer-thin-ring">
      <g id="vault-circle-frame">
        <SelectedGlow selected={selected} />
        <g id="vault-outer-ring2">
          {/* Glow around the full vault circle */}
          <g id="glow" filter="url(#filter0_d_4015_16261)">
            <path
              d="M857.785 502.066c0 196.457-159.26 355.717-355.718 355.717-196.457 0-355.717-159.26-355.717-355.717 0-196.458 159.26-355.718 355.717-355.718 196.458 0 355.718 159.26 355.718 355.718Z"
              fill="#382315"
            />
            <path
              d="M502.067 858.532c196.871 0 356.467-159.596 356.467-356.467 0-196.87-159.596-356.466-356.467-356.466-196.87 0-356.466 159.596-356.466 356.466 0 196.871 159.596 356.467 356.466 356.467Z"
              stroke="#985F39"
              strokeWidth={1.497}
            />
          </g>
          <OuterRingTickmarks />
        </g>
      </g>
    </g>
  );
};
