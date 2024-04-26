import styled from 'styled-components';
import { VaultPage } from '../types';
import { useRotationAngle } from '../useRotationAngle';

type Props = {
  selected?: VaultPage;
  onClickButton: (page: VaultPage) => void;
};

const COLOR_SELECTED_FILL = '#FFDEC9';
const COLOR_DEFAULT_FILL_CIRCLE = '#3C2211';
const COLOR_DEFAULT_FILL_ICON = '#BD7B4F';

export const Nav = ({ selected, onClickButton }: Props) => {
  const circleFill = (item: VaultPage) =>
    item === selected ? COLOR_SELECTED_FILL : COLOR_DEFAULT_FILL_CIRCLE;
  const iconFill = (item: VaultPage) =>
    item === selected ? COLOR_SELECTED_FILL : COLOR_DEFAULT_FILL_ICON;

  const [angle, prevAngle, duration, ref] = useRotationAngle(selected, true);

  // Leaving this calculation here to show how it was derived.
  // These hard coded numbers come directly from the figma file.
  const bbBoxPosition = {
    x: -591.29,
    y: 98.82,
  };
  const bbLength = 1504.52;
  const center = {
    x: bbBoxPosition.x + bbLength / 2,
    y: bbBoxPosition.y + bbLength / 2,
  };

  const transform = `rotate(${angle} ${center.x} ${center.y})`;

  return (
    <g id="nav">
      <g id="background_2" stroke="#BD7B4F">
        <path
          id="nav-buttons-fill"
          d="M.867 115.363v59.683a699.627 699.627 0 0 1 320.574-.345v-59.653a758.777 758.777 0 0 0-320.574.315Z"
          fill="url(#paint4_radial_4383_16241)"
        />
        <path
          id="nav-buttons-lines"
          d="M322.072 112.115a761.785 761.785 0 0 0-321.842.316m1.328 65.537a696.642 696.642 0 0 1 319.199-.344M71.971 162.036l-7.504-57.702m193.307-.188-7.504 57.695m-59.353-4.967 2.499-58.123m-64.576.083 2.499 58.122m118.961 4.885 7.504-57.695"
          strokeMiterlimit={10}
        />
      </g>
      <g id="buttons">
        <g id="claim-button">
          <g id="CLAIM_2">
            <text
              transform="rotate(-9.84 906.643 -61.458)"
              fill={iconFill('claim')}
              xmlSpace="preserve"
              style={{
                whiteSpace: 'pre',
              }}
              fontFamily="Caviar Dreams"
              fontSize={8}
              fontWeight="bold"
              letterSpacing=".1em"
            >
              <tspan x={0.404} y={7.783}>
                {'CLAIM'}
              </tspan>
            </text>
          </g>
          <path
            id="claim-icon"
            fillRule="evenodd"
            clipRule="evenodd"
            d="m34.02 126.37 2.646 7.263c.252.059.495.146.725.257l3.17-3.519-2.267 4.151c.249.242.463.522.631.833l4.965.251-4.59 1.908c-.054.35-.161.685-.314.996l3.532 3.146-4.17-2.246a3.47 3.47 0 0 1-.596.486l-.044 7.73-2.645-7.263a3.45 3.45 0 0 1-.726-.258l-3.17 3.52 2.268-4.152a3.423 3.423 0 0 1-.632-.832l-4.964-.251 4.59-1.909c.053-.349.16-.685.314-.996l-3.533-3.146 4.17 2.247c.179-.183.378-.346.596-.487l.045-7.729Z"
            fill={iconFill('claim')}
          />
          <circle
            id="claim-vault-indicator-circle"
            cx={33.042}
            cy={118.556}
            r={2.799}
            fill={circleFill('claim')}
            stroke="#985F39"
            strokeWidth={1.123}
          />
          <HitTarget
            id="claim-button-target"
            d="m71.97 162.03-7.503-57.702a750.768 750.768 0 0 0-63.63 11.023v59.773l12.396-2.926A699.112 699.112 0 0 1 71.97 162.03Z"
            fill="#000"
            fillOpacity={0.01}
            onClick={() => onClickButton('claim')}
          />
        </g>
        <g id="timing-button">
          <g id="TIMING">
            <text
              transform="rotate(9.84 -736.916 1641.297)"
              fill={iconFill('timing')}
              xmlSpace="preserve"
              style={{
                whiteSpace: 'pre',
              }}
              fontFamily="Caviar Dreams"
              fontSize={8}
              fontWeight="bold"
              letterSpacing=".1em"
            >
              <tspan x={0.352} y={7.783}>
                {'TIMING'}
              </tspan>
            </text>
          </g>
          <path
            id="timing-icon"
            fillRule="evenodd"
            clipRule="evenodd"
            d="M278.302 136.803a9.427 9.427 0 1 1 18.577 3.223 9.427 9.427 0 0 1-18.577-3.223Zm7.743-6.632a8.322 8.322 0 0 0-1.966.628 8.904 8.904 0 0 0 7.631 14.917 8.474 8.474 0 0 0 1.569-1.144 8.906 8.906 0 0 1-7.234-14.401Zm.851-.115a8.38 8.38 0 0 0-1.266 1.98l3.604-1.844a8.387 8.387 0 0 0-2.338-.136Zm3.79.564-5.558 2.842-.052.217a8.594 8.594 0 0 0-.161.989l6.873-3.514a8.363 8.363 0 0 0-1.102-.534Zm2.086 1.201-7.893 4.036c.015.384.057.766.125 1.144l8.621-4.408a8.562 8.562 0 0 0-.853-.772Zm1.545 1.589-9.057 4.63c.107.34.236.673.387.999l9.251-4.734a8.453 8.453 0 0 0-.581-.895Zm1.035 1.833-9.211 4.713c.161.26.336.509.523.748l8.988-4.598a8.54 8.54 0 0 0-.3-.863Zm.529 1.916-8.499 4.348c.261.257.539.496.831.716l7.761-3.968a8.295 8.295 0 0 0-.093-1.096Zm.027 2.3-6.683 3.417a8.561 8.561 0 0 0 1.051.484l5.41-2.766a8.61 8.61 0 0 0 .222-1.135Zm-.755 2.578-3.393 1.734c.724.13 1.462.164 2.195.101a8.347 8.347 0 0 0 1.198-1.835Z"
            fill={iconFill('timing')}
          />
          <circle
            id="timing-vault-indicator-cirle"
            cx={290.951}
            cy={119.017}
            r={2.799}
            fill={circleFill('timing')}
            stroke="#985F39"
            strokeWidth={1.123}
          />
          <HitTarget
            id="timing-button-target"
            d="m309.045 171.898 12.396 3.101v-59.948a768.77 768.77 0 0 0-63.668-10.91l-7.503 57.694a690.718 690.718 0 0 1 58.775 10.063Z"
            fill="#000"
            fillOpacity={0.01}
            onClick={() => onClickButton('timing')}
          />
        </g>
        <g id="stake-button">
          <g id="STAKE">
            <text
              transform="rotate(-4.92 1726.887 -938.584)"
              fill={iconFill('stake')}
              xmlSpace="preserve"
              style={{
                whiteSpace: 'pre',
              }}
              fontFamily="Caviar Dreams"
              fontSize={8}
              fontWeight="bold"
              letterSpacing=".1em"
            >
              <tspan x={0.068} y={7.783}>
                {'STAKE'}
              </tspan>
            </text>
          </g>
          <g id="stake-icon" fill={iconFill('stake')}>
            <path d="M99.559 132.571c1.272-.109 2.217-1.21 2.11-2.459a2.237 2.237 0 0 0-.639-1.381 2.32 2.32 0 0 0-1.86-.683v.002c-1.273.11-2.218 1.211-2.11 2.459.107 1.249 1.226 2.172 2.499 2.062Z" />
            <path
              fillRule="evenodd"
              clipRule="evenodd"
              d="M106.637 124.878a7.487 7.487 0 0 0-2.707-5.132 7.791 7.791 0 0 0-5.625-1.739 7.789 7.789 0 0 0-5.245 2.675 7.487 7.487 0 0 0-1.79 5.519l1.164 13.526 15.367-1.323-1.164-13.526Zm-12.846-3.604a6.828 6.828 0 0 1 4.593-2.344 6.825 6.825 0 0 1 4.926 1.525 6.602 6.602 0 0 1 1.915 2.596 7.569 7.569 0 0 0-1.108-1.128 7.834 7.834 0 0 0-8.517-.912c-.9.459-1.7 1.087-2.353 1.848a7.586 7.586 0 0 0-.899 1.301 6.613 6.613 0 0 1 1.443-2.886Zm-1.384 7.022.898 10.425 6.733-.579-.39-4.531c1.894-.163 3.293-1.788 3.135-3.62-.158-1.832-1.813-3.194-3.707-3.031l-.504-5.853a6.87 6.87 0 0 0-2.532.724 6.787 6.787 0 0 0-2.062 1.62 6.637 6.637 0 0 0-1.275 2.27 6.528 6.528 0 0 0-.296 2.575Z"
            />
          </g>
          <circle
            id="stake-vault-indicator-circle"
            cx={97.253}
            cy={110.173}
            r={2.799}
            fill={circleFill('stake')}
            stroke="#985F39"
            strokeWidth={1.123}
          />
          <HitTarget
            id="stake-button-target"
            d="m131.331 156.927-2.499-58.122a757.003 757.003 0 0 0-64.335 5.522l7.504 57.703a700.846 700.846 0 0 1 59.33-5.103Z"
            fill="#000"
            fillOpacity={0.01}
            onClick={() => onClickButton('stake')}
          />
        </g>
        <g id="strategy-button">
          <g id="STRATEGY">
            <text
              transform="rotate(4.92 -1557.105 2399.813)"
              fill={iconFill('strategy')}
              xmlSpace="preserve"
              style={{
                whiteSpace: 'pre',
              }}
              fontFamily="Caviar Dreams"
              fontSize={8}
              fontWeight="bold"
              letterSpacing=".1em"
            >
              <tspan x={0.388} y={7.783}>
                {'STRATEGY'}
              </tspan>
            </text>
          </g>
          <g id="strategy-icon" fill={iconFill('strategy')}>
            <path d="m224.445 128.24.668-1.147-1.239.466-.334-1.285-.548 1.209-1.141-.67.462 1.243-1.279.336 1.203.55-.668 1.147 1.239-.466.334 1.284.548-1.208 1.141.67-.463-1.244 1.279-.336-1.202-.549Z" />
            <path
              fillRule="evenodd"
              clipRule="evenodd"
              d="M217.545 121.672a2.267 2.267 0 0 1 2.811-.094 7.579 7.579 0 0 1 7.163.638 2.267 2.267 0 0 1 2.604.642c.653.779.698 1.869.185 2.687a7.673 7.673 0 0 1-.616 7.227 2.294 2.294 0 0 1-.625 2.654 2.268 2.268 0 0 1-2.71.165 7.583 7.583 0 0 1-7.194-.625 2.267 2.267 0 0 1-2.605-.642 2.29 2.29 0 0 1-.184-2.688 7.672 7.672 0 0 1 .598-7.198 2.293 2.293 0 0 1 .573-2.766Zm11.907 1.753a1.392 1.392 0 0 0-1.969-.169 1.408 1.408 0 0 0-.17 1.978 1.392 1.392 0 0 0 1.969.169 1.408 1.408 0 0 0 .17-1.978Zm-3.764 11.488a2.294 2.294 0 0 1 .451-2.982 2.268 2.268 0 0 1 3.002.063 6.794 6.794 0 0 0 .498-5.761 2.267 2.267 0 0 1-2.997-.432 2.293 2.293 0 0 1 .088-3.04 6.709 6.709 0 0 0-5.752-.486 2.293 2.293 0 0 1-.506 2.892 2.267 2.267 0 0 1-2.923.006 6.797 6.797 0 0 0-.506 5.776 2.267 2.267 0 0 1 2.996.433 2.292 2.292 0 0 1-.087 3.039 6.713 6.713 0 0 0 5.736.492Zm-8.289-3.134a1.393 1.393 0 0 1 1.969.17 1.408 1.408 0 0 1-.17 1.978 1.395 1.395 0 0 1-1.97-.17 1.409 1.409 0 0 1 .171-1.978Zm2.679-9.264a1.392 1.392 0 0 0-1.969-.169 1.408 1.408 0 0 0-.17 1.978 1.392 1.392 0 0 0 1.969.169 1.408 1.408 0 0 0 .17-1.978Zm6.625 10.09a1.394 1.394 0 0 1 1.97.169 1.408 1.408 0 0 1-.17 1.978c-.591.5-1.473.424-1.97-.169a1.409 1.409 0 0 1 .17-1.978Z"
            />
            <path d="m225.954 118.846-1.609-1.92-1.913 1.617 1.609 1.92 1.913-1.617ZM234.953 129.717l-1.913 1.617-1.609-1.92 1.913-1.617 1.609 1.92ZM220.63 138.317l1.608 1.921 1.913-1.618-1.608-1.92-1.913 1.617ZM211.72 127.617l1.913-1.617 1.609 1.92-1.913 1.617-1.609-1.92Z" />
          </g>
          <circle
            id="strategy-vault-indicator-circle"
            cx={224.933}
            cy={110.361}
            r={2.799}
            fill={circleFill('strategy')}
            stroke="#985F39"
            strokeWidth={1.123}
          />
          <HitTarget
            id="strategy-button-target"
            d="m250.299 161.836 7.504-57.695a754.669 754.669 0 0 0-64.358-5.395l-2.499 58.123c20.01.82 39.794 2.476 59.353 4.967Z"
            fill="#000"
            fillOpacity={0.01}
            onClick={() => onClickButton('strategy')}
          />
        </g>
        <g id="summary-selected">
          <g id="SUMMARY">
            <text
              fill={iconFill('summary')}
              xmlSpace="preserve"
              style={{
                whiteSpace: 'pre',
              }}
              fontFamily="Caviar Dreams"
              fontSize={8}
              fontWeight="bold"
              letterSpacing=".1em"
            >
              <tspan x={139.44} y={149.029}>
                {'SUMMARY'}
              </tspan>
            </text>
          </g>
          <g id="summary-icon" fill={iconFill('summary')}>
            <path d="M162.312 125.645a1.633 1.633 0 1 1-3.266 0 1.633 1.633 0 0 1 3.266 0Z" />
            <path
              fillRule="evenodd"
              clipRule="evenodd"
              d="m149.823 125.706 10.854-10.854 10.498 10.497c.015.014.03.028.044.044l.312.313-.305.305-.029.031-10.182 10.183-.031.028-.307.307-10.854-10.854Zm10.856-9.509 9.033 9.034h-3.256l-5.777-5.777v-3.257Zm-.336 4.265 5.244 5.244-4.908 4.908-5.244-5.244 4.908-4.908Zm-5.917 5.244 5.777 5.777v3.258l-9.035-9.035h3.258Zm14.015.475h1.27l-.635.636-.635-.636Zm-1.985 0h.91l1.172 1.173-.583.584-1.628-1.628.129-.129Zm-1.25 1.25.584-.583 1.627 1.627-.583.584-1.628-1.628Zm-1.121 1.121.584-.583 1.627 1.627-.583.584-1.628-1.628Zm-1.121 1.121.584-.584 1.627 1.628-.583.583-1.628-1.627Zm-1.121 1.121.584-.584 1.627 1.628-.583.583-1.628-1.627Zm-.689.689.152-.152 1.628 1.628-.583.583-1.197-1.197v-.862Zm.659 2.596-.659-.659v1.319l.659-.66Z"
            />
          </g>
          <circle
            id="summary-vault-indicator-circle"
            cx={161.038}
            cy={107.388}
            r={2.799}
            fill={circleFill('summary')}
            stroke="#BD7B4F"
            strokeWidth={1.123}
          />
          <HitTarget
            id="summary-button-target"
            d="M161.855 156.261c9.74 0 19.427.202 29.062.607l2.498-58.122a777 777 0 0 0-31.56-.668c-11.06 0-22.065.25-33.015.75l2.498 58.123c10.12-.45 20.293-.68 30.517-.69Z"
            fill="#000"
            fillOpacity={0.01}
            onClick={() => onClickButton('summary')}
          />
        </g>
      </g>
      <g id="selector" transform={transform}>
        <animateTransform
          ref={ref}
          attributeName="transform"
          attributeType="XML"
          type="rotate"
          from={`${prevAngle} ${center.x} ${center.y}`}
          to={`${angle} ${center.x} ${center.y}`}
          dur={`${duration}ms`}
          repeatCount="1"
          calcMode="spline"
          keySplines=" .4,0, .58,1"
        />
        <g id="selector-rotation" filter="url(#filter8_i_4383_16241)">
          <g id="selector_2">
            <path
              id="selector-shiny"
              d="m154.007 86.814 4.611 13.808a.599.599 0 0 0 .21.291.56.56 0 0 0 .334.11h3.631a.558.558 0 0 0 .335-.11.599.599 0 0 0 .21-.291l4.606-13.808a.617.617 0 0 0-.075-.54.56.56 0 0 0-.468-.25h-12.85a.562.562 0 0 0-.469.25.623.623 0 0 0-.075.54Z"
              fill="url(#paint5_linear_4383_16241)"
            />
            <g id="selector-dark" fillRule="evenodd" clipRule="evenodd">
              <path
                d="M159.761 98.742h2.428v-.001a.558.558 0 0 0 .337-.108.595.595 0 0 0 .213-.292l3.256-9.761a.61.61 0 0 0-.075-.541.562.562 0 0 0-.469-.251h-8.946a.56.56 0 0 0-.469.25.612.612 0 0 0-.075.542l3.256 9.76a.597.597 0 0 0 .21.292c.098.072.214.11.334.11Zm.529-.51h1.371a.556.556 0 0 0 .314-.097.517.517 0 0 0 .195-.255l3.013-8.693a.493.493 0 0 0-.074-.464.558.558 0 0 0-.437-.214h-7.394a.561.561 0 0 0-.245.057.535.535 0 0 0-.191.158.502.502 0 0 0-.074.463l3.012 8.693a.513.513 0 0 0 .196.255.553.553 0 0 0 .314.098Z"
                fill="#361D0C"
              />
              <path
                d="M161.032 90.927c.633 0 1.146.533 1.146 1.191s-.513 1.192-1.146 1.192c-.633 0-1.146-.534-1.146-1.192 0-.658.513-1.191 1.146-1.191Zm2.051 1.191c0-1.178-.918-2.132-2.051-2.132s-2.051.954-2.051 2.132c0 1.178.918 2.133 2.051 2.133s2.051-.955 2.051-2.133Z"
                fill="#382315"
              />
            </g>
            <g id="selector-light" filter="url(#filter9_d_4383_16241)">
              <path
                d="M159.834 92.117c0 .688.536 1.245 1.198 1.245.661 0 1.197-.557 1.197-1.245 0-.688-.536-1.246-1.197-1.246-.662 0-1.198.558-1.198 1.246Z"
                fill="#FFDEC9"
              />
            </g>
          </g>
        </g>
      </g>
    </g>
  );
};

const HitTarget = styled.path`
  cursor: pointer;
`;
