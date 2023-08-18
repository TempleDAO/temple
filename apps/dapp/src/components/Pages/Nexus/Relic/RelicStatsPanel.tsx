import relicImg from 'assets/images/relic.png';
import relicStructureImg from 'assets/images/nexus/relic_anim_structure.gif';
import relicChaosImg from 'assets/images/nexus/relic_anim_chaos.gif';
import relicLogicImg from 'assets/images/nexus/relic_anim_logic.gif';
import relicOrderImg from 'assets/images/nexus/relic_anim_order.gif';
import relicMysteryImg from 'assets/images/nexus/relic_anim_mystery.gif';
import { Button } from 'components/Button/Button';
import { useWindowResize } from 'components/Vault/useWindowResize';
import { capitalize } from 'lodash';
import { useRelic } from 'providers/RelicProvider';
import { RelicData, RelicEnclave, RelicRarity } from 'providers/types';
import { FC, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import styled, { DefaultTheme } from 'styled-components';

const RelicStatsPanel: FC<{ relic: RelicData }> = (props) => {
  const { id, rarity, enclave, xp, items } = props.relic;
  const containerRef = useRef<HTMLDivElement>(null);
  const windowWidth = useWindowResize();
  const [componentWidth, setComponentWidth] = useState(100);
  useEffect(() => {
    setComponentWidth(containerRef.current?.offsetWidth ?? 100);
  }, [windowWidth]);
  // const { renounceRelic } = useRelic();
  const navigate = useNavigate();

  // TODO: we could clean this up and move it to another place
  let relicImageUrl = relicChaosImg;

  switch (enclave) {
    case RelicEnclave.Mystery:
      relicImageUrl = relicMysteryImg;
      break;
    case RelicEnclave.Logic:
      relicImageUrl = relicLogicImg;
      break;
    case RelicEnclave.Order:
      relicImageUrl = relicOrderImg;
      break;
    case RelicEnclave.Structure:
      relicImageUrl = relicStructureImg;
      break;
  }

  const relicBadge = (
    <RelicBadge>
      <RelicImage src={relicImageUrl} />
      <RelicName enclave={enclave}>Relic #{id.toString()}</RelicName>
    </RelicBadge>
  );
  const enclaveInfo = <RelicStatsItem label="Enclave" element={<EnclaveLabel enclave={enclave} />} />;
  const rarityInfo = <RelicStatsItem label="Rarity" element={<RarityLabel rarity={rarity} />} />;
  const poapInfo = <RelicStatsItem label="Shards" element={<span>{items.reduce((n, i) => n + i.count, 0)}</span>} />;
  const xpInfo = <RelicStatsItem label="XP" element={<span>{xp.toNumber()}</span>} />;

  if (componentWidth > 700) {
    return (
      <RelicStatsContainer ref={containerRef}>
        <RelicStatsColumn>
          {enclaveInfo}
          {poapInfo}
        </RelicStatsColumn>
        {relicBadge}
        <RelicStatsColumn>
          {rarityInfo}
          {xpInfo}
        </RelicStatsColumn>
      </RelicStatsContainer>
    );
  } else {
    return (
      <RelicStatsContainer ref={containerRef}>
        {relicBadge}
        <RelicStatsColumn>
          {enclaveInfo}
          {rarityInfo}
          {poapInfo}
          {xpInfo}
        </RelicStatsColumn>
      </RelicStatsContainer>
    );
  }
};

const RelicStatsItem: FC<{ label: string; element: JSX.Element }> = (props) => {
  return (
    <RelicStatsRow>
      <span>{props.label}:</span>
      {props.element}
    </RelicStatsRow>
  );
};

const RelicStatsContainer = styled.div`
  width: 100%;
  text-align: center;
  display: flex;
  flex-direction: row;
  flex-wrap: wrap;
  gap: 16px;
`;

const RelicStatsColumn = styled.div`
  flex-grow: 1;
  flex-basis: 100px;
  padding: 2em 1em;
  background-color: ${(props) => props.theme.palette.dark75};
  border-radius: 16px;
`;

const RelicImage = styled.img`
  width: 270px;
  margin-left: -50vw;
  margin-right: -50vw;
  max-width: 100vw;
`;

const RelicName = styled.h3<{ enclave: RelicEnclave }>`
  color: ${(props) => props.theme.palette.enclave[getEnclavePalette(props.enclave)]};
  margin: 0;
  background-color: ${(props) => props.theme.palette.dark75};
  padding: 16px;
  border-radius: 16px;
`;

const RelicBadge = styled.div`
  flex-grow: 1;
  flex-basis: 80px;
`;

const RelicStatsRow = styled.h4`
  display: flex;
  justify-content: center;
  margin: 0;
  gap: 0.25em;

  > * {
    flex-grow: 1;
    flex-basis: 8em;
  }

  > *:first-child {
    text-align: right;
  }
  > *:last-child {
    text-align: left;
  }
`;

type EnclavePalette = keyof DefaultTheme['palette']['enclave'];
type RarityPalette = keyof DefaultTheme['palette']['relicRarity'];

export function getEnclavePalette(enclave: RelicEnclave): EnclavePalette {
  switch (enclave) {
    case RelicEnclave.Logic:
      return 'logic';
    case RelicEnclave.Structure:
      return 'structure';
    case RelicEnclave.Order:
      return 'order';
    case RelicEnclave.Mystery:
      return 'mystery';
    case RelicEnclave.Chaos:
      return 'chaos';
  }
}

export function getRarityPalette(rarity: RelicRarity): RarityPalette {
  switch (rarity) {
    case RelicRarity.Common:
      return 'common';
    case RelicRarity.Uncommon:
      return 'uncommon';
    case RelicRarity.Rare:
      return 'rare';
    case RelicRarity.Epic:
      return 'epic';
    case RelicRarity.Legendary:
      return 'legendary';
  }
}

const EnclaveLabel = styled.span<{ enclave: RelicEnclave }>`
  &:before {
    content: '${(props) => capitalize(getEnclavePalette(props.enclave))}';
  }
  color: ${(props) => props.theme.palette.enclave[getEnclavePalette(props.enclave)]};
`;
const RarityLabel = styled.span<{ rarity: RelicRarity }>`
  &:before {
    content: '${(props) => capitalize(getRarityPalette(props.rarity))}';
  }
  color: ${(props) => props.theme.palette.relicRarity[getRarityPalette(props.rarity)]};
`;

export default RelicStatsPanel;
