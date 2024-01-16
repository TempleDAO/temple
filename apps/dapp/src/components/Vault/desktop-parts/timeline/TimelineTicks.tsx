import { VaultGroup } from 'components/Vault/types';
import { lerp } from '../../utils';

type Props = {
  vaultGroup: VaultGroup;
};

export const TimelineTicks = ({ vaultGroup }: Props) => {
  const minAngleTrack = 161;
  const maxAngleTrack = 2;
  const minAngleTick = -80.5;
  const maxAngleTick = 80.5;
  const percent =
    vaultGroup.enterExitWindowDurationSeconds /
    vaultGroup.periodDurationSeconds;
  const periods = vaultGroup.periods;

  const trackAngle = lerp(minAngleTrack, maxAngleTrack, percent);

  const ticks = [];

  ticks.push(<Tick key={1001} id={1001} angle={minAngleTick} />);
  ticks.push(<Tick key={1002} id={1002} angle={maxAngleTick} />);

  for (let i = 1; i < periods; i++) {
    const angleDelta = (maxAngleTick * 2) / periods;
    const angle = minAngleTick + angleDelta * i;
    ticks.push(<Tick key={i} id={i} angle={angle} />);
  }

  return (
    <g id="dynamic-timeline" clipPath="url(#clip0_4015_16261)">
      <text
        id="START"
        fill="#351F11"
        xmlSpace="preserve"
        style={{
          whiteSpace: 'pre',
        }}
        fontFamily="Caviar Dreams"
        fontSize={12}
        fontWeight="bold"
        letterSpacing=".15em"
      >
        <tspan x={178} y={526}>
          Start
        </tspan>
      </text>
      <text
        id="label"
        fill="#351F11"
        xmlSpace="preserve"
        style={{
          whiteSpace: 'pre',
        }}
        fontFamily="Caviar Dreams"
        fontSize={12}
        fontWeight="bold"
        letterSpacing=".15em"
      >
        <tspan x={793.481} y={526.065}>
          End
        </tspan>
      </text>
      <g id="track">
        <mask
          id="mask0_4015_16261"
          style={{ maskType: 'alpha' }}
          maskUnits="userSpaceOnUse"
          x={182}
          y={556}
          width={634}
          height={287}
        >
          <path
            id="rotationMask"
            d="M192.5 559L182 567.5V604.5L230.5 707.5L314 785L524 843L732 760.5L816 637L811.5 558H800L789.5 556L204 558L192.5 559Z"
            fill="black"
          />
        </mask>
        <g mask="url(#mask0_4015_16261)">
          <g
            id="rotation frame-track"
            transform={`rotate(${trackAngle} 502.066 502.066)`}
          >
            <path
              id="one-month-progress-bar-outline"
              fillRule="evenodd"
              clipRule="evenodd"
              d="M201.148 547.969L201.763 551.786C211.872 614.509 241.465 672.939 286.962 718.436C343.994 775.468 421.346 807.509 502.002 807.509C582.657 807.509 660.009 775.468 717.041 718.436C762.539 672.939 792.131 614.509 802.24 551.786L802.855 547.969L810.49 549.199L809.874 553.016C799.509 617.334 769.164 677.25 722.509 723.904C664.027 782.387 584.708 815.242 502.002 815.242C419.295 815.242 339.977 782.387 281.494 723.904C234.839 677.25 204.495 617.334 194.129 553.016L193.514 549.199L201.148 547.969Z"
              stroke="#BD7B4F"
              strokeWidth={2}
            />
          </g>
        </g>
      </g>
      {ticks}
    </g>
  );
};

const Tick = ({ id, angle }: { id: number; angle: number }) => (
  <g id={`tick-${id}`} transform={`rotate(${angle} 502.066 502.066)`}>
    <path
      id="tick"
      fillRule="evenodd"
      clipRule="evenodd"
      d="M502.994 776.008H500.994V790.008H502.994V776.008ZM502.994 832.008H500.994V846.008H502.994V832.008Z"
      fill="#382315"
    />
  </g>
);
