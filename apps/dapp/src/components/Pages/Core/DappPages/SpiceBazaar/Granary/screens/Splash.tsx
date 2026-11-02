import { useNavigate, useSearchParams } from 'react-router-dom';
import styled from 'styled-components';
import paintedWell from 'assets/images/granary-painted-well.webp';
import type { Phase } from '../data/types';
import { Btn, C, Eyebrow, Moon, Note, TextLink } from '../ui';
import { paths } from '../paths';

// Splash art is still undecided. Flip the default here, or try either with ?art=painted / ?art=drawn.
export const SPLASH_ART: 'drawn' | 'painted' = 'drawn';

export const Splash = () => {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const painted = (params.get('art') ?? SPLASH_ART) === 'painted';
  return (
    <Wrap $painted={painted}>
      <Copy>
        <Eyebrow>Temple Gold</Eyebrow>
        <Title>The Temple Granary</Title>
        <Lore>
          {painted && 'Pilgrims bring their wishes to the well. '}
          The Bazaar&apos;s stalls have folded. The Temple keeps a granary now,
          and keeps it by the moon. At the new moon a price is carved in stone;
          the waxing moon gathers tenders; the gibbous moon fills the stores; at
          the full moon every tender is answered in the same measure.
        </Lore>
        <Plain>
          Stake TEMPLE to earn Temple Gold. Deposit into fixed-price auctions
          run by the Treasury, or make a wish for a swap you&apos;d like to see.
          Each auction moves through four phases, drawn as the moon: Scheduled,
          Deposit, Fulfillment, Settlement.
        </Plain>
        <Ctas>
          <Btn onClick={() => navigate(paths.earn)}>Earn Temple Gold</Btn>
          <Btn $ghost onClick={() => navigate(paths.auctions())}>
            Auctions
          </Btn>
        </Ctas>
        <Note>
          Bid in the old Spice Bazaar?{' '}
          <TextLink to={paths.legacy}>
            Claim what&apos;s left in My Activity
          </TextLink>
        </Note>
      </Copy>
      {!painted && <Scene />}
    </Wrap>
  );
};

const STARS = [
  [40, 40],
  [92, 118],
  [150, 30],
  [210, 92],
  [268, 22],
  [330, 60],
  [402, 26],
  [470, 94],
  [530, 40],
  [600, 72],
  [620, 18],
  [62, 180],
  [580, 170],
  [18, 110],
  [350, 128],
];
const ARC: Phase[] = ['Scheduled', 'Deposit', 'Fulfillment', 'Settlement'];

const Sack = ({ x, s = 1 }: { x: number; s?: number }) => (
  <g transform={`translate(${x} 334) scale(${s})`}>
    <path
      d="M-22 0 q-10 -30 8 -42 l4 -7 h20 l4 7 q18 12 8 42Z"
      fill="#7a5235"
      stroke="#95613F"
    />
    <ellipse cx="0" cy="-49" rx="13" ry="4" fill="#EAB85B" />
    <path d="M-12 -40 q12 6 24 0" stroke="#5a3b25" fill="none" />
  </g>
);

const Wheat = ({ x, h }: { x: number; h: number }) => (
  <g stroke="#BD7B4F" strokeWidth="1.2" fill="#D9A441">
    <path d={`M${x} 334 v-${h}`} fill="none" />
    {[0, 1, 2, 3].map((k) => {
      const y1 = 334 - h + 6 + k * 7,
        y2 = 334 - h + 9 + k * 7;
      return (
        <g key={k}>
          <ellipse
            cx={x - 3}
            cy={y1}
            rx="2.4"
            ry="4.5"
            transform={`rotate(-25 ${x - 3} ${y1})`}
          />
          <ellipse
            cx={x + 3}
            cy={y2}
            rx="2.4"
            ry="4.5"
            transform={`rotate(25 ${x + 3} ${y2})`}
          />
        </g>
      );
    })}
  </g>
);

// The granary at night under the four phase moons, so the splash teaches the icon set.
const Scene = () => (
  <SceneSvg
    viewBox="0 0 640 380"
    role="img"
    aria-label="The Temple granary at night under four moons, from new moon to full moon, with grain sacks"
  >
    <defs>
      <radialGradient id="granary-halo" cx="50%" cy="55%" r="50%">
        <stop offset="0" stopColor="#EAB85B" stopOpacity=".18" />
        <stop offset="1" stopColor="#EAB85B" stopOpacity="0" />
      </radialGradient>
      <linearGradient id="granary-door" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#F1DDB0" />
        <stop offset="1" stopColor="#BD7B4F" />
      </linearGradient>
    </defs>
    {STARS.map(([x, y], i) => (
      <circle
        key={`${x}-${y}`}
        cx={x}
        cy={y}
        r={i % 3 ? 1 : 1.6}
        fill="#F1DDB0"
        opacity={i % 2 ? 0.35 : 0.6}
      />
    ))}
    <path
      d="M150 59 Q 309 -6 468 59"
      fill="none"
      stroke="#3a2a1f"
      strokeDasharray="3 5"
    />
    {ARC.map((p, i) => {
      const x = 150 + i * 106,
        y = 72 - Math.round(Math.sin(((i + 0.5) / 4) * Math.PI) * 34);
      return (
        <g key={p}>
          <svg x={x - 21} y={y - 21} width="42" height="42" viewBox="0 0 24 24">
            <Moon phase={p} size={24} />
          </svg>
          <text
            x={x}
            y={y + 38}
            textAnchor="middle"
            fill={C.muted}
            fontSize="15"
          >
            {p}
          </text>
        </g>
      );
    })}
    <ellipse cx="320" cy="250" rx="230" ry="130" fill="url(#granary-halo)" />
    <path d="M-800 360 Q320 300 1440 360 V380 H-800Z" fill="#161110" />
    <rect
      x="196"
      y="322"
      width="248"
      height="12"
      fill="#2a1f19"
      stroke="#5a4433"
    />
    <rect
      x="212"
      y="310"
      width="216"
      height="12"
      fill="#2a1f19"
      stroke="#5a4433"
    />
    <rect
      x="232"
      y="206"
      width="176"
      height="104"
      fill="#1d1613"
      stroke="#95613F"
    />
    <path d="M220 206 H420 L408 192 H232Z" fill="#2a1f19" stroke="#BD7B4F" />
    <path d="M248 192 Q320 98 392 192Z" fill="#221915" stroke="#BD7B4F" />
    <path
      d="M266 166 Q320 138 374 166 M284 140 Q320 122 356 140"
      stroke="#5a4433"
      fill="none"
    />
    <path d="M320 120 v-16" stroke="#BD7B4F" />
    <circle cx="320" cy="100" r="4.5" fill="#EAB85B" />
    {[242, 268, 360, 386].map((x) => (
      <rect
        key={x}
        x={x}
        y="206"
        width="12"
        height="104"
        fill="#2a1f19"
        stroke="#5a4433"
      />
    ))}
    <path
      d="M296 310 V256 a24 24 0 0 1 48 0 V310Z"
      fill="url(#granary-door)"
      opacity=".9"
    />
    <path d="M320 232 v78" stroke="#95613F" opacity=".6" />
    <Sack x={176} />
    <Sack x={208} s={0.82} />
    <Sack x={452} s={0.9} />
    <Sack x={486} />
    <Wheat x={150} h={46} />
    <Wheat x={160} h={38} />
    <Wheat x={510} h={42} />
  </SceneSvg>
);

const Wrap = styled.div<{ $painted: boolean }>`
  display: grid;
  grid-template-columns: minmax(0, 0.9fr) minmax(0, 1.25fr);
  gap: 8px;
  align-items: center;
  padding: 26px 26px 0;
  border: 1px solid ${({ theme }) => theme.palette.brandDark};
  border-radius: 14px;
  overflow: hidden;
  background: radial-gradient(
      500px 300px at 70% 30%,
      rgba(241, 221, 176, 0.08),
      transparent 70%
    ),
    #0d0c0c;
  ${({ $painted }) =>
    $painted &&
    `
    grid-template-columns: minmax(0, 1fr);
    min-height: 470px;
    padding: 32px;
    align-items: end;
    background:
      linear-gradient(90deg, rgba(11,10,10,.94) 0%, rgba(11,10,10,.78) 38%, rgba(11,10,10,.05) 72%),
      url(${paintedWell}) center 40% / cover no-repeat;
    > div { max-width: 380px; padding-bottom: 0; }
  `}
`;

const Copy = styled.div`
  position: relative;
  z-index: 1;
  display: grid;
  gap: 14px;
  align-content: center;
  padding-bottom: 26px;
`;

const Title = styled.h2`
  ${({ theme }) => theme.typography.fonts.fontHeading};
  font-weight: 400;
  font-size: 34px;
  line-height: 1.15;
  margin: 0;
  color: ${({ theme }) => theme.palette.brandLight};
`;

const Lore = styled.p`
  ${({ theme }) => theme.typography.fonts.fontHeading};
  font-style: italic;
  color: ${({ theme }) => theme.palette.gold};
  font-size: 16px;
  margin: 0;
  border-left: 1px solid ${({ theme }) => theme.palette.brandDark};
  padding-left: 14px;
`;

const Plain = styled.p`
  font-size: 14px;
  margin: 0;
  max-width: 46ch;
`;

const Ctas = styled.div`
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
`;

const SceneSvg = styled.svg`
  width: 100%;
  height: auto;
  display: block;
  overflow: visible;
`;
