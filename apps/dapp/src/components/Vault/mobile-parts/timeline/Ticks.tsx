import { VaultGroup } from 'components/Vault/types';

interface Props {
  vaultGroup: VaultGroup;
}

export const Ticks = ({ vaultGroup }: Props) => {

  const tickComponents: Record<number, JSX.Element> = {
    12: (
      <g id="twelve-month">
        <path
          id="zone"
          fillRule="evenodd"
          clipRule="evenodd"
          d="M46.758 540.309H23.323v-3.149h23.435v3.149Z"
          stroke="#BD7B4F"
        />
        <path
          id="ticks_2"
          d="M297.143 549.301v5.458m-22.819-5.458v5.458m-22.818-5.458v5.458m-22.818-5.458v5.458m-22.818-5.458v5.458m-22.819-5.458v5.458m-22.818-5.458v5.458m-22.818-5.458v5.458m-22.819-5.458v5.458m-22.818-5.458v5.458m-22.818-5.458v5.458m-22.818-5.458v5.458m-22.819-5.458v5.458m273.82-31.458v5.458m-22.819-5.458v5.458m-22.818-5.458v5.458m-22.818-5.458v5.458m-22.818-5.458v5.458m-22.819-5.458v5.458m-22.818-5.458v5.458m-22.818-5.458v5.458m-22.819-5.458v5.458m-22.818-5.458v5.458m-22.818-5.458v5.458m-22.818-5.458v5.458m-22.819-5.458v5.458"
          stroke="#351F11"
        />
        <text
          id="12 MO"
          fill="#351F11"
          xmlSpace="preserve"
          style={{
            whiteSpace: 'pre',
          }}
          fontFamily="Caviar Dreams"
          fontSize={8}
          fontWeight="bold"
          letterSpacing=".15em"
        >
          <tspan x={279.448} y={516.979}>
            {'12 MO.'}
          </tspan>
        </text>
      </g>
    ),
    6: (
      <g id="six-month">
        <path
          id="zone_2"
          fillRule="evenodd"
          clipRule="evenodd"
          d="M69.047 540.309H23.323v-3.149h45.724v3.149Z"
          stroke="#BD7B4F"
        />
        <path
          id="ticks_3"
          d="M297.143 549.301v5.458m-45.637-5.458v5.458m-45.636-5.458v5.458m-45.637-5.458v5.458m-45.637-5.458v5.458m-45.636-5.458v5.458m-45.637-5.458v5.458m273.82-31.458v5.458m-45.637-5.458v5.458m-45.636-5.458v5.458m-45.637-5.458v5.458m-45.637-5.458v5.458m-45.636-5.458v5.458m-45.637-5.458v5.458"
          stroke="#351F11"
        />
        <text
          id="6 MO"
          fill="#351F11"
          xmlSpace="preserve"
          style={{
            whiteSpace: 'pre',
          }}
          fontFamily="Caviar Dreams"
          fontSize={8}
          fontWeight="bold"
          letterSpacing=".15em"
        >
          <tspan x={282.867} y={516.979}>
            {'6 MO.'}
          </tspan>
        </text>
      </g>
    ),
    4: (
      <g id="four-month">
        <path
          id="zone_3"
          fillRule="evenodd"
          clipRule="evenodd"
          d="M92 540.309H23.322v-3.149H92v3.149Z"
          stroke="#BD7B4F"
        />
        <path
          id="ticks_4"
          d="M297.143 549.301v5.458m-68.455-5.458v5.458m-68.455-5.458v5.458m-68.455-5.458v5.458m-68.455-5.458v5.458m273.82-31.458v5.458m-68.455-5.458v5.458m-68.455-5.458v5.458m-68.455-5.458v5.458m-68.455-5.458v5.458"
          stroke="#351F11"
        />
        <text
          id="4 MO"
          fill="#351F11"
          xmlSpace="preserve"
          style={{
            whiteSpace: 'pre',
          }}
          fontFamily="Caviar Dreams"
          fontSize={8}
          fontWeight="bold"
          letterSpacing=".15em"
        >
          <tspan x={282.755} y={516.979}>
            {'4 MO.'}
          </tspan>
        </text>
      </g>
    ),
    3: (
      <g id="three-month">
        <path
          id="three-month-progress-bar-outline"
          fillRule="evenodd"
          clipRule="evenodd"
          d="M114.874 540.309h-91.55v-3.149h91.55v3.149Z"
          stroke="#BD7B4F"
        />
        <path
          id="three-month-tickmark"
          d="M297.143 549.301v5.458m-91.273-5.458v5.458m-91.274-5.458v5.458m-91.273-5.458v5.458m273.82-31.458v5.458m-91.273-5.458v5.458m-91.274-5.458v5.458m-91.273-5.458v5.458"
          stroke="#351F11"
        />
        <text
          id="3 MO"
          fill="#351F11"
          xmlSpace="preserve"
          style={{
            whiteSpace: 'pre',
          }}
          fontFamily="Caviar Dreams"
          fontSize={8}
          fontWeight="bold"
          letterSpacing=".15em"
        >
          <tspan x={282.837} y={516.979}>
            {'3 MO.'}
          </tspan>
        </text>
      </g>
    ),
    1: (
      <g id="one-month">
        <path
          id="zone_4"
          fillRule="evenodd"
          clipRule="evenodd"
          d="M297.143 540.309H23.323v-3.149h273.82v3.149Z"
          stroke="#BD7B4F"
        />
        <path
          id="ticks_5"
          d="M297.143 549.301v5.458m-273.82-5.458v5.458m273.82-31.458v5.458m-273.82-5.458v5.458"
          stroke="#351F11"
        />
        <text
          id="1 MO"
          fill="#351F11"
          xmlSpace="preserve"
          style={{
            whiteSpace: 'pre',
          }}
          fontFamily="Caviar Dreams"
          fontSize={8}
          fontWeight="bold"
          letterSpacing=".15em"
        >
          <tspan x={282.603} y={516.979}>
            {'1 MO.'}
          </tspan>
        </text>
      </g>
    ),
  };

  return (
    <g id="ticks">
      {tickComponents[vaultGroup.months]}
      <circle
        id="timeline-end-marker"
        cx={297.143}
        cy={538.769}
        r={3.394}
        fill="#BD7B4F"
      />
      <circle
        id="timeline-start-marker"
        cx={23.324}
        cy={538.769}
        r={3.394}
        fill="#BD7B4F"
      />
      <text
        id="START"
        fill="#351F11"
        xmlSpace="preserve"
        style={{
          whiteSpace: 'pre',
        }}
        fontFamily="Caviar Dreams"
        fontSize={8}
        fontWeight="bold"
        letterSpacing=".15em"
      >
        <tspan x={9.791} y={516.979}>
          {'START'}
        </tspan>
      </text>
    </g>
  );
};
