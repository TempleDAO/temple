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
import { NexusVideo, VideoPlaybackConfig } from '../NexusVideo';
import mintSuccessvideo from 'assets/videos/m17.mp4';
import { ZERO } from 'utils/bigNumber';
import { BigNumber } from 'ethers';
import { Popover } from 'components/Popover';
import { useWallet } from 'providers/WalletProvider';

type MintRelicPanelProps = {
  onSelectEnclave: (enclave: RelicEnclave) => void;
};

const MintRelicPanel = ({ onSelectEnclave }: MintRelicPanelProps) => {
  const navigate = useNavigate();
  const [selectedEnclave, setSelectedEnclave] = useState<RelicEnclave>();
  const enclaves = [
    RelicEnclave.Logic,
    RelicEnclave.Structure,
    RelicEnclave.Order,
    RelicEnclave.Mystery,
    RelicEnclave.Chaos,
  ];

  const [newRelicId, setNewRelicId] = useState(ZERO);

  const videoConfig: VideoPlaybackConfig = {
    videoSrc: mintSuccessvideo,
    onPlaybackCompleteHandler: () => {
      navigate(`/nexus/relic/${newRelicId.toString()}`);
    },
  };

  const onMintHandler = (relicId: BigNumber) => {
    setNewRelicId(relicId);
    setVideoIsOpen(true);
  };

  const [videoIsOpen, setVideoIsOpen] = useState(false);

  const selectEnclaveHandler = (enclave: RelicEnclave) => {
    onSelectEnclave(enclave);
    setSelectedEnclave(enclave != selectedEnclave ? enclave : undefined);
  };

  return videoIsOpen ? (
    <Popover
      onClose={() => {
        navigate(`/nexus/relic/${newRelicId.toString()}`);
      }}
      isOpen={videoIsOpen}
      showCloseButton={false}
    >
      <PopoverChildContainer>
        <NexusVideo config={videoConfig} />
        <CloseVideoButton label="Close" onClick={() => setVideoIsOpen(false)} />
      </PopoverChildContainer>
    </Popover>
  ) : (
    <>
      <EnclaveCardContainer>
        {enclaves.map((enclave) => (
          <EnclaveCard
            key={enclave}
            enclave={enclave}
            selected={enclave == selectedEnclave}
            onClick={() => selectEnclaveHandler(enclave)}
          />
        ))}
      </EnclaveCardContainer>
      {/* <br /> */}
      {/* <br /> */}
      {/* <MintRelicButtonStyled selectedEnclave={selectedEnclave} onMintHandler={onMintHandler} /> */}
    </>
  );
};

const PopoverChildContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
`;

const CloseVideoButton = styled(Button)`
  width: 200px;
  margin-top: 20px;
  border-radius: 4px;
`;

const MintRelicButton: FC<{ selectedEnclave?: RelicEnclave; onMintHandler: (relicId: BigNumber) => void }> = (
  props
) => {
  const { selectedEnclave, onMintHandler } = props;
  const { wallet, walletAddress } = useWallet();
  const enclaveSelected = selectedEnclave != undefined;
  const label = enclaveSelected
    ? `Mint *${capitalize(getEnclavePalette(selectedEnclave))}* Relic`
    : 'You must choose an enclave first.';
  const { mintRelic } = useRelic();

  return enclaveSelected ? (
    <Button
      label={label}
      playClickSound
      disabled={!enclaveSelected}
      onClick={async () => {
        if (enclaveSelected && wallet) {
          const added = await mintRelic(wallet, selectedEnclave);
          if (added) {
            onMintHandler(added.id);
          }
        }
      }}
    />
  ) : null;
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
