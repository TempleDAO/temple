import Image from 'components/Image/Image';
import nexusSoundtrack from 'assets/sounds/m08-buf2.mp3';
import ReactHowler from 'react-howler';
import playingIcon from 'assets/icons/sound_icon.png';
import stoppedIcon from 'assets/icons/sound_icon_off.png';
import { useState } from 'react';
import styled from 'styled-components';
import { clickSound } from 'utils/sound';

const SOUNDSCAPE_VOLUME = 0.15;

export const NexusSoundscape = () => {
  const [volume, setVolume] = useState(SOUNDSCAPE_VOLUME);

  const icon = volume > 0 ? playingIcon : stoppedIcon;

  const soundIconClickHandler = () => {
    clickSound.play();
    const isPlaying = volume > 0;
    const newVolume = isPlaying ? 0 : SOUNDSCAPE_VOLUME;
    setVolume(newVolume);
  };

  return (
    <FullScreenContainer>
      <NexusSoundscapeContainer>
        <SoundscapeIcon src={icon} onClick={soundIconClickHandler} />
        <ReactHowler src={nexusSoundtrack} playing={true} loop volume={volume} />
      </NexusSoundscapeContainer>
    </FullScreenContainer>
  );
};

const FullScreenContainer = styled.div`
  position: absolute;
  top: 0;
  left: 0;
  z-index: 9;
`;

const SoundscapeIcon = styled(Image)`
  width: 30px;
  height: 30px;
  filter: invert(45%) sepia(100%) saturate(263%) hue-rotate(341deg) brightness(97%) contrast(86%);
`;

const NexusSoundscapeContainer = styled.div`
  position: fixed;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  bottom: 0;
  right: 0;
  margin-right: 25px;
  margin-bottom: 25px;
  height: 50px;
  width: 50px;
  background-color: #000;
  border: 1px solid ${(props) => props.theme.palette.brandDark};
  border-radius: 50%;
`;
