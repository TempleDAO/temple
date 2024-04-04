import { format } from 'date-fns';
import { lerp } from 'components/Vault/utils';
import { VaultGroup } from 'components/Vault/types';

interface Props {
  vaultGroup: VaultGroup;
}

export const Ticks = ({ vaultGroup }: Props) => {
  const min = -270;
  const max = 0;
  const percent =
    vaultGroup.enterExitWindowDurationSeconds /
    vaultGroup.periodDurationSeconds;
  const periods = vaultGroup.periods;
  const zoneLength = lerp(min, max, percent);

  const ticks = [];
  const maxDistance = 274;
  const distBetween = maxDistance / periods;
  for (let i = 1; i < periods; i++) {
    const distance = distBetween * i;
    ticks.push(<Tick key={i} id={i} distance={distance} />);
  }

  const startLabel = format(vaultGroup.cycleStart, 'LLL d');
  const endLabel = format(vaultGroup.cycleEnd, 'LLL d');

  return (
    <g id="ticks">
      <g id="dynamic-timeline">
        <g id="track_2">
          <mask
            id="mask0_4383_16241"
            style={{
              maskType: 'alpha',
            }}
            maskUnits="userSpaceOnUse"
            x={23}
            y={528}
            width={274}
            height={22}
          >
            <rect
              id="mask"
              x={23}
              y={528}
              width={274}
              height={22}
              fill="#C4C4C4"
            />
          </mask>
          <g mask="url(#mask0_4383_16241)">
            <g id="movable-frame" transform={`translate(${zoneLength})`}>
              <path
                id="zone"
                fillRule="evenodd"
                clipRule="evenodd"
                d="M295 540L22 540L22 537L295 537L295 540Z"
                stroke="#BD7B4F"
              />
            </g>
          </g>
        </g>
        <path
          id="end-ticks"
          d="M297.143 549.297V554.755M23.3232 549.297V554.755M297.143 523.297V528.755M23.3232 523.297V528.755"
          stroke="#351F11"
        />
        {ticks}
      </g>
      <text
        id="end-label"
        fill="#351F11"
        xmlSpace="preserve"
        style={{
          whiteSpace: 'pre',
        }}
        fontFamily="Caviar Dreams"
        fontSize={8}
        fontWeight="bold"
        letterSpacing="0.15em"
      >
        <tspan x={288} y={516.975}>
          End
        </tspan>
      </text>
      <circle
        id="timeline-end-marker"
        cx={297.143}
        cy={538.765}
        r={3.39414}
        fill="#BD7B4F"
      />
      <circle
        id="timeline-start-marker"
        cx={23.3238}
        cy={538.765}
        r={3.39414}
        fill="#BD7B4F"
      />
      <text
        fill="#351F11"
        xmlSpace="preserve"
        style={{
          whiteSpace: 'pre',
        }}
        fontFamily="Caviar Dreams"
        fontSize={8}
        fontWeight="bold"
        letterSpacing="0.15em"
      >
        <tspan x={12} y={516.975}>
          Start
        </tspan>
      </text>
    </g>
  );
};

const Tick = ({ id, distance }: { id: number; distance: number }) => (
  <g key={id} id={`tick-${id}`} transform={`translate(${distance})`}>
    <path
      id="three-month-tickmark"
      d="M23 549.297V554.755M23 523.297V528.755"
      stroke="#351F11"
    />
  </g>
);
