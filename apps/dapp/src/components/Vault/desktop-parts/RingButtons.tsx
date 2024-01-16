import { resolvePath, matchPath, useResolvedPath } from 'react-router-dom';
import styled from 'styled-components';

import { VaultPage } from '../types';

type Props = {
  selected?: VaultPage;
  onClickButton: (page: VaultPage) => void;
};

export const RingButtons = ({ selected, onClickButton }: Props) => {
  const circleFill = (item: VaultPage) =>
    item === selected ? COLOR_SELECTED_FILL : COLOR_DEFAULT_FILL_CIRCLE;
  const iconFill = (item: VaultPage) =>
    item === selected ? COLOR_SELECTED_FILL : COLOR_DEFAULT_FILL_ICON;

  return (
    <g id="vault-icons">
      <path
        id="vault-button-circle"
        d="M502.067 848.227c191.177 0 346.156-154.979 346.156-346.156 0-191.176-154.979-346.155-346.156-346.155-191.176 0-346.155 154.979-346.155 346.155 0 191.177 154.979 346.156 346.155 346.156Z"
        fill="url(#paint72_radial_4015_16261)"
        stroke="#BD7B4F"
        strokeWidth={1.497}
      />
      <g id="vault-button-lines" filter="url(#filter1_d_4015_16261)">
        <path
          fillRule="evenodd"
          clipRule="evenodd"
          d="M847.474 502.068c0 .516-.001 1.032-.003 1.547h-72.175a398.357 398.357 0 0 0 0-3.093h72.175c.002.515.003 1.031.003 1.546ZM724.04 342.709l58.395-42.427a338.89 338.89 0 0 0-1.82-2.501l-58.395 42.427c.611.83 1.218 1.664 1.82 2.501ZM587.994 242.621l22.31-68.662c-.979-.322-1.96-.641-2.942-.955l-22.31 68.661c.983.313 1.964.632 2.942.956Zm-168.911-.956-22.31-68.661c-.983.314-1.963.632-2.942.955l22.31 68.662a259 259 0 0 1 2.942-.956Zm-137.168 98.543-58.396-42.427c-.61.831-1.217 1.665-1.82 2.501l58.396 42.427a279.85 279.85 0 0 1 1.82-2.501Zm-53.076 160.314a265.343 265.343 0 0 0 0 3.093h-72.175a265.686 265.686 0 0 1 0-3.093h72.175Z"
          fill="#593821"
        />
      </g>
      <g id="claim">
        <path
          id="vault-indicator-circle_2"
          d="M237.162 414.7a3.87 3.87 0 1 1-7.74 0 3.87 3.87 0 0 1 7.74 0Z"
          fill={circleFill('claim')}
          stroke="#985F39"
          strokeWidth={1.497}
        />
        <path
          id="claim-icon"
          fillRule="evenodd"
          clipRule="evenodd"
          d="m184.953 399.014 13.821 1.9a6.317 6.317 0 0 1 1.023-.94l-2.946-8.025 4.715 7.117a6.232 6.232 0 0 1 1.861-.306l4.585-7.712-.823 8.935c.513.38.958.834 1.325 1.341l7.998-2.986-7.1 4.761c.141.439.234.895.275 1.361l12.298 6.586-13.821-1.9c-.307.353-.65.668-1.022.94l2.945 8.025-4.715-7.117a6.19 6.19 0 0 1-1.86.306l-4.586 7.712.823-8.934a6.238 6.238 0 0 1-1.325-1.341l-7.998 2.986 7.1-4.761a6.247 6.247 0 0 1-.274-1.361l-12.299-6.587Z"
          fill={iconFill('claim')}
        />
        {selected !== 'claim' ? (
          <text
            id="claim-default"
            transform="rotate(-72 341.877 124.731)"
            fill="#AB8165"
            xmlSpace="preserve"
            style={{
              whiteSpace: 'pre',
            }}
            fontFamily="Caviar Dreams"
            fontSize={17.961}
            fontWeight="bold"
            letterSpacing=".1em"
          >
            <tspan x={1.347} y={17.748}>
              {'CLAIM'}
            </tspan>
          </text>
        ) : (
          <g id="claim-selected" filter="url(#filter3_d_4015_16261)">
            <text
              transform="rotate(-72 332.799 140.936)"
              fill="#FFDEC9"
              xmlSpace="preserve"
              style={{
                whiteSpace: 'pre',
              }}
              fontFamily="Caviar Dreams"
              fontSize={22.437}
              fontWeight="bold"
              letterSpacing=".1em"
            >
              <tspan x={4.338} y={21.806}>
                {'CLAIM'}
              </tspan>
            </text>
          </g>
        )}
        <HitTarget
          id="claim-button-target"
          d="M157.428 502.077h72.111a271.229 271.229 0 0 1 52.053-160.193L223.256 299.5a343.063 343.063 0 0 0-65.828 202.577Z"
          fill="#000"
          fillOpacity={0.01}
          onClick={() => onClickButton('claim')}
        />
      </g>

      <g id="stake">
        <circle
          id="vault-indicator-circle_4"
          cx={335.952}
          cy={273.567}
          r={3.87}
          fill={circleFill('stake')}
          stroke="#985F39"
          strokeWidth={1.497}
        />
        <g id="stake-icon" fill={iconFill('stake')}>
          <path d="M321.592 253.856c1.866-1.356 2.3-3.938.971-5.768a4.037 4.037 0 0 0-2.275-1.54 4.19 4.19 0 0 0-3.512.678l.002.003c-1.866 1.356-2.3 3.938-.971 5.768 1.33 1.829 3.92 2.214 5.785.859Z" />
          <path
            fillRule="evenodd"
            clipRule="evenodd"
            d="M325.365 235.368a13.51 13.51 0 0 0-8.966-5.409 14.06 14.06 0 0 0-10.316 2.551 14.064 14.064 0 0 0-5.614 9.022 13.513 13.513 0 0 0 2.374 10.199l14.403 19.824 22.522-16.363-14.403-19.824Zm-23.214 6.399a12.316 12.316 0 0 1 4.916-7.903 12.32 12.32 0 0 1 9.035-2.234 11.947 11.947 0 0 1 5.379 2.229 13.695 13.695 0 0 0-2.764-.71 14.065 14.065 0 0 0-10.316 2.551 14.171 14.171 0 0 0-3.7 3.974 13.956 13.956 0 0 0-1.914 5.049 13.686 13.686 0 0 0-.178 2.848 11.927 11.927 0 0 1-.458-5.804Zm4.403 12.143 11.101 15.279 9.868-7.17-4.824-6.639c2.777-2.017 3.424-5.832 1.473-8.517-1.951-2.685-5.779-3.248-8.555-1.231l-6.232-8.578a12.39 12.39 0 0 0-3.239 3.479 12.202 12.202 0 0 0-1.677 4.424 11.964 11.964 0 0 0 .142 4.698 11.786 11.786 0 0 0 1.943 4.255Z"
          />
        </g>
        {selected !== 'stake' ? (
          <text
            id="stake-default"
            transform="rotate(-36 432.073 -272.505)"
            fill="#AB8165"
            xmlSpace="preserve"
            style={{
              whiteSpace: 'pre',
            }}
            fontFamily="Caviar Dreams"
            fontSize={17.961}
            fontWeight="bold"
            letterSpacing=".1em"
          >
            <tspan x={1.383} y={17.748}>
              {'STAKE'}
            </tspan>
          </text>
        ) : (
          <g id="stake-selected" filter="url(#filter5_d_4015_16261)">
            <text
              transform="rotate(-36 406.557 -250.855)"
              fill="#FFDEC9"
              xmlSpace="preserve"
              style={{
                whiteSpace: 'pre',
              }}
              fontFamily="Caviar Dreams"
              fontSize={22.437}
              fontWeight="bold"
              letterSpacing=".1em"
            >
              <tspan x={1.449} y={21.806}>
                {'STAKE'}
              </tspan>
            </text>
          </g>
        )}
        <HitTarget
          id="stake-button-target"
          d="m417.838 242.824-22.285-68.59a345.264 345.264 0 0 0-172.295 125.232l58.335 42.383a273.043 273.043 0 0 1 136.245-99.025Z"
          fill="#000"
          fillOpacity={0.01}
          onClick={() => onClickButton('stake')}
        />
      </g>

      <g id="summary">
        <circle
          id="vault-indicator-circle_5"
          cx={502.126}
          cy={219.524}
          r={3.87}
          fill={circleFill('summary')}
          stroke="#BD7B4F"
          strokeWidth={1.497}
        />
        <g id="summary-icon" fill={iconFill('summary')}>
          <path d="M505.017 188.512a2.948 2.948 0 1 1-5.896 0 2.948 2.948 0 0 1 5.896 0Z" />
          <path
            fillRule="evenodd"
            clipRule="evenodd"
            d="m482.477 188.621 19.59-19.59 18.946 18.947a.851.851 0 0 1 .08.079l.564.564-.552.552a.677.677 0 0 1-.051.056l-18.378 18.378a.889.889 0 0 1-.056.051l-.553.554-19.59-19.591Zm19.592-17.161 16.305 16.305h-5.878l-10.427-10.427v-5.878Zm-.606 7.698 9.465 9.465-8.859 8.858-9.465-9.465 8.859-8.858Zm-10.678 9.465 10.426 10.426v5.881l-16.307-16.307h5.881Zm25.294.857h2.293l-1.146 1.147-1.147-1.147Zm-3.583 0h1.642l2.117 2.117-1.053 1.053-2.938-2.938.232-.232Zm-2.255 2.255 1.053-1.053 2.938 2.938-1.053 1.053-2.938-2.938Zm-2.023 2.023 1.053-1.052 2.938 2.938-1.053 1.052-2.938-2.938Zm-2.023 2.024 1.053-1.053 2.937 2.938-1.052 1.053-2.938-2.938Zm-2.023 2.023 1.052-1.053 2.938 2.938-1.053 1.053-2.937-2.938Zm-1.245 1.244.274-.274 2.938 2.938-1.051 1.052-2.161-2.16v-1.556Zm1.19 4.686-1.19-1.189v2.379l1.19-1.19Z"
          />
        </g>
        {selected !== 'summary' ? (
          <text
            id="summary-default"
            fill="#AB8165"
            xmlSpace="preserve"
            style={{
              whiteSpace: 'pre',
            }}
            fontFamily="Caviar Dreams"
            fontSize={17.961}
            fontWeight="bold"
            letterSpacing=".1em"
          >
            <tspan x={451.224} y={124.647}>
              {'SUMMARY'}
            </tspan>
          </text>
        ) : (
          <g id="summary-selected" filter="url(#filter6_d_4015_16261)">
            <text
              fill="#FFDEC9"
              xmlSpace="preserve"
              style={{
                whiteSpace: 'pre',
              }}
              fontFamily="Caviar Dreams"
              fontSize={22.437}
              fontWeight="bold"
              letterSpacing=".1em"
            >
              <tspan x={438.881} y={109.704}>
                {'SUMMARY'}
              </tspan>
            </text>
          </g>
        )}
        <HitTarget
          id="summary-button-target"
          d="M502.073 229.544a272.313 272.313 0 0 1 84.233 13.283l22.285-68.59a344.347 344.347 0 0 0-106.518-16.803 344.347 344.347 0 0 0-106.518 16.803l22.285 68.59a272.372 272.372 0 0 1 84.233-13.283Z"
          fill="#000"
          fillOpacity={0.01}
          onClick={() => onClickButton('summary')}
        />
      </g>

      <g id="strategy">
        <path
          id="vault-indicator-circle_3"
          d="M672.076 273.532a3.87 3.87 0 1 1-7.74 0 3.87 3.87 0 0 1 7.74 0Z"
          fill={circleFill('strategy')}
          stroke="#985F39"
          strokeWidth={1.497}
        />
        <g id="strategy-icon" fill={iconFill('strategy')}>
          <path d="m688.697 248.859 2.101-1.149-2.349-.435.681-2.296-1.973 1.357-1.139-2.1-.445 2.354-2.29-.672 1.347 1.97-2.101 1.15 2.349.435-.681 2.296 1.973-1.357 1.14 2.099.444-2.354 2.29.673-1.347-1.971Z" />
          <path
            fillRule="evenodd"
            clipRule="evenodd"
            d="M684.15 232.279a4.092 4.092 0 0 1 4.434 2.473 13.677 13.677 0 0 1 10.477 7.661 4.093 4.093 0 0 1 3.428 3.419 4.138 4.138 0 0 1-2.218 4.325 13.85 13.85 0 0 1-7.685 10.597 4.14 4.14 0 0 1-3.44 3.52 4.093 4.093 0 0 1-4.343-2.27 13.685 13.685 0 0 1-10.537-7.669 4.094 4.094 0 0 1-3.43-3.419 4.139 4.139 0 0 1 2.221-4.327 13.846 13.846 0 0 1 7.63-10.569 4.138 4.138 0 0 1 3.463-3.741Zm16.774 13.804a2.516 2.516 0 0 0-2.887-2.097 2.542 2.542 0 0 0-2.106 2.899 2.514 2.514 0 0 0 2.886 2.097 2.542 2.542 0 0 0 2.107-2.899Zm-16.523 14.25a4.138 4.138 0 0 1 3.476-4.189 4.092 4.092 0 0 1 4.581 2.895 12.266 12.266 0 0 0 6.138-8.442 4.093 4.093 0 0 1-4.231-3.46 4.137 4.137 0 0 1 2.97-4.617 12.113 12.113 0 0 0-8.439-6.111 4.138 4.138 0 0 1-3.476 3.999 4.092 4.092 0 0 1-4.525-2.714 12.263 12.263 0 0 0-6.164 8.456 4.094 4.094 0 0 1 4.229 3.461 4.137 4.137 0 0 1-2.967 4.616 12.11 12.11 0 0 0 8.408 6.106Zm-9.893-12.568a2.515 2.515 0 0 1 2.886 2.098 2.543 2.543 0 0 1-2.106 2.899 2.516 2.516 0 0 1-2.887-2.098 2.543 2.543 0 0 1 2.107-2.899Zm12.773-11.823a2.515 2.515 0 0 0-2.886-2.097 2.541 2.541 0 0 0-2.106 2.899 2.514 2.514 0 0 0 2.886 2.097 2.54 2.54 0 0 0 2.106-2.899Zm.841 21.769a2.515 2.515 0 0 1 2.886 2.097 2.542 2.542 0 0 1-2.106 2.899 2.515 2.515 0 0 1-2.887-2.097 2.542 2.542 0 0 1 2.107-2.899Z"
          />
          <path d="m699.782 235.745-.698-4.467-4.464.717.698 4.467 4.464-.717ZM703.564 260.934l-4.464.717-.698-4.467 4.464-.717.698 4.467ZM673.41 260.882l.697 4.467 4.465-.717-.698-4.467-4.464.717ZM669.608 236.04l4.464-.717.698 4.467-4.464.717-.698-4.467Z" />
        </g>
        {selected !== 'strategy' ? (
          <text
            id="strategy-default"
            transform="rotate(36 111.568 1148.235)"
            fill="#AB8165"
            xmlSpace="preserve"
            style={{
              whiteSpace: 'pre',
            }}
            fontFamily="Caviar Dreams"
            fontSize={17.961}
            fontWeight="bold"
            letterSpacing=".1em"
          >
            <tspan x={1.909} y={17.748}>
              {'STRATEGY'}
            </tspan>
          </text>
        ) : (
          <g id="strategy-selected" filter="url(#filter4_d_4015_16261)">
            <text
              transform="rotate(36 146.521 1142.128)"
              fill="#FFDEC9"
              xmlSpace="preserve"
              style={{
                whiteSpace: 'pre',
              }}
              fontFamily="Caviar Dreams"
              fontSize={22.437}
              fontWeight="bold"
              letterSpacing=".1em"
            >
              <tspan x={1.442} y={21.806}>
                {'STRATEGY'}
              </tspan>
            </text>
          </g>
        )}
        <HitTarget
          id="strategy-button-target"
          d="m608.592 174.234-22.285 68.59a273.055 273.055 0 0 1 136.245 99.056l58.346-42.384a345.3 345.3 0 0 0-172.306-125.262Z"
          fill="#000"
          fillOpacity={0.01}
          onClick={() => onClickButton('strategy')}
        />
      </g>

      <g id="timing">
        <path
          id="vault-indicator-circle"
          d="M774.722 414.809a3.87 3.87 0 1 1-7.738.002 3.87 3.87 0 0 1 7.738-.002Z"
          fill={circleFill('timing')}
          stroke="#985F39"
          strokeWidth={1.497}
        />
        <path
          id="timing-icon"
          fillRule="evenodd"
          clipRule="evenodd"
          d="M795.604 421.113c-8.936-2.904-13.826-12.502-10.923-21.437 2.903-8.936 12.501-13.827 21.437-10.923 8.936 2.903 13.826 12.501 10.923 21.437-2.904 8.936-12.501 13.826-21.437 10.923Zm-9.866-15.533c.054 1.255.265 2.488.619 3.673a16.07 16.07 0 0 0 26.267-1.694 16.06 16.06 0 0 0 2.338-8.118 15.15 15.15 0 0 0-1.641-3.096 16.13 16.13 0 0 1-.68 3.09c-2.743 8.442-11.81 13.062-20.252 10.319a16.006 16.006 0 0 1-6.651-4.174Zm.014-1.549a15.146 15.146 0 0 0 3.212 2.769l-2.37-6.912a15.152 15.152 0 0 0-.842 4.143Zm1.979-6.627 3.653 10.657a14.993 14.993 0 0 0 2.1.69l-4.518-13.179a14.939 14.939 0 0 0-1.235 1.832Zm2.679-3.419 5.188 15.135c.69.071 1.384.094 2.077.07l-5.667-16.531c-.56.403-1.095.846-1.598 1.326Zm3.234-2.353 5.953 17.366a15.18 15.18 0 0 0 1.883-.434l-6.086-17.742c-.6.233-1.185.504-1.75.81Zm3.542-1.381 6.06 17.665c.504-.221.995-.47 1.47-.743l-5.912-17.236c-.547.076-1.087.181-1.618.314Zm3.557-.454 5.592 16.299a15.251 15.251 0 0 0 1.492-1.302l-5.101-14.881a15.048 15.048 0 0 0-1.983-.116Zm4.116.541 4.394 12.816a15.154 15.154 0 0 0 1.134-1.753l-3.556-10.374a15.248 15.248 0 0 0-1.972-.689Zm4.412 2.01 2.23 6.506c.418-1.26.668-2.57.742-3.896a15.045 15.045 0 0 0-2.972-2.61Z"
          fill={iconFill('timing')}
        />
        {selected !== 'timing' ? (
          <text
            id="timing-default"
            transform="rotate(72 195.272 770.133)"
            fill="#AB8165"
            xmlSpace="preserve"
            style={{
              whiteSpace: 'pre',
            }}
            fontFamily="Caviar Dreams"
            fontSize={17.961}
            fontWeight="bold"
            letterSpacing=".1em"
          >
            <tspan x={1.471} y={17.748}>
              {'TIMING'}
            </tspan>
          </text>
        ) : (
          <g id="timing-selected" filter="url(#filter2_d_4015_16261)">
            <text
              transform="rotate(72 213.073 772.162)"
              fill="#FFDEC9"
              xmlSpace="preserve"
              style={{
                whiteSpace: 'pre',
              }}
              fontFamily="Caviar Dreams"
              fontSize={22.437}
              fontWeight="bold"
              letterSpacing=".1em"
            >
              <tspan x={2.276} y={21.806}>
                {'TIMING'}
              </tspan>
            </text>
          </g>
        )}
        <HitTarget
          id="timing-button-target"
          d="M846.713 502.077A343.056 343.056 0 0 0 780.894 299.5l-58.345 42.384a271.236 271.236 0 0 1 52.053 160.193h72.111Z"
          fill="#fff"
          fillOpacity={0.01}
          onClick={() => onClickButton('timing')}
        />
      </g>
    </g>
  );
};

const COLOR_SELECTED_FILL = '#FFDEC9';
const COLOR_DEFAULT_FILL_CIRCLE = '#3C2211';
const COLOR_DEFAULT_FILL_ICON = '#BD7B4F';

const HitTarget = styled.path`
  cursor: pointer;
`;
