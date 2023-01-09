import { Button } from 'components/Button/Button';
import { capitalize } from 'lodash';
import { useRelic } from 'providers/RelicProvider';
import { RelicEnclave } from 'providers/types';
import { FC, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import styled from 'styled-components';
import { getEnclavePalette } from './RelicStatsPanel';
import { NexusPanel, NexusPanelRow } from './styles';

import chaosImg from 'assets/images/enclave/chaos.jpg';
import logicImg from 'assets/images/enclave/logic.jpg';
import mysteryImg from 'assets/images/enclave/mystery.jpg';
import orderImg from 'assets/images/enclave/order.jpg';
import structureImg from 'assets/images/enclave/structure.jpg';
import { darken, lighten } from 'polished';

const MintRelicPanel = () => {
  const [selectedEnclave, setSelectedEnclave] = useState<RelicEnclave>();
  const enclaves = [
    RelicEnclave.Logic,
    RelicEnclave.Structure,
    RelicEnclave.Order,
    RelicEnclave.Mystery,
    RelicEnclave.Chaos,
  ];
  return (
    <NexusPanel>
      <NexusPanelRow>Mint Relic</NexusPanelRow>
      <EnclaveCardContainer>
        {enclaves.map((enclave) => (
          <EnclaveCard
            key={enclave}
            enclave={enclave}
            selected={enclave == selectedEnclave}
            onClick={() => setSelectedEnclave(enclave != selectedEnclave ? enclave : undefined)}
          />
        ))}
      </EnclaveCardContainer>
      <br />
      <br />
      <MintRelicButtonStyled selectedEnclave={selectedEnclave} />
    </NexusPanel>
  );
};

const MintRelicButton: FC<{ selectedEnclave?: RelicEnclave }> = (props) => {
  const { selectedEnclave } = props;
  const enclaveSelected = selectedEnclave != undefined;
  const label = enclaveSelected
    ? `Mint *${capitalize(getEnclavePalette(selectedEnclave))}* Relic`
    : 'You must choose an enclave first.';
  const { mintRelic } = useRelic();
  const navigate = useNavigate();
  return (
    <Button
      label={label}
      disabled={!enclaveSelected}
      onClick={async () => {
        if (enclaveSelected) {
          const added = await mintRelic(selectedEnclave);
          if (added) {
            navigate(`/nexus/relic/${added.id.toString()}`);
          }
        }
      }}
    />
  );
};

const MintRelicButtonStyled = styled(MintRelicButton)`
  border-radius: 16px;
`;

const EnclaveCardContainer = styled.div`
  display: flex;
  flex-direction: row;
  width: 100%;
  gap: 0.5%;
  margin-top: 0.5em;

  > * {
    flex-grow: 1;
    height: 250px;
  }
`;

const EnclaveCard = styled.div<{ enclave: RelicEnclave; selected?: boolean }>`
  position: relative;
  background-image: ${(props) => `url(${getEnclaveImg(props.enclave)})`};
  background-color: ${(props) =>
    lighten(props.selected ? 0.2 : -0.1, props.theme.palette.enclave[getEnclavePalette(props.enclave)])};
  background-blend-mode: multiply;
  background-size: cover;
  background-position: center;
  border: 0.0625rem solid;
  border-color: ${(props) =>
    lighten(props.selected ? 0.2 : 0, props.theme.palette.enclave[getEnclavePalette(props.enclave)])};
  border-radius: 8px;
  transition: ease 0.25s all;
  transform: scale(${(props) => (props.selected ? 1.1 : 1)});
  z-index: ${(props) => (props.selected ? 2 : 1)};
  color: ${(props) => darken(props.selected ? 0 : 0.02, '#FFFFFF')};
  cursor: pointer;

  &:hover {
    background-color: ${(props) =>
      lighten(props.selected ? 0.25 : 0.2, props.theme.palette.enclave[getEnclavePalette(props.enclave)])};
    border-color: ${(props) =>
      lighten(props.selected ? 0.25 : 0.2, props.theme.palette.enclave[getEnclavePalette(props.enclave)])};
    color: ${(props) => darken(props.selected ? 0 : 0.02, '#FFFFFF')};
  }

  &:before {
    content: '${(props) => capitalize(getEnclavePalette(props.enclave))}';
    position: absolute;
    bottom: 1em;
    left: 50%;
    transform: translate(-50%);
    font-size: 20px;
  }
`;

function getEnclaveImg(enclave: RelicEnclave) {
  switch (enclave) {
    case RelicEnclave.Logic:
      return logicImg;
    case RelicEnclave.Structure:
      return structureImg;
    case RelicEnclave.Order:
      return orderImg;
    case RelicEnclave.Mystery:
      return mysteryImg;
    case RelicEnclave.Chaos:
      return chaosImg;
  }
}

export default MintRelicPanel;
