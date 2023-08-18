import { Howl } from 'howler';
import clickAudio from 'assets/sounds/clicksound2.mp3';
import equipAudio from 'assets/sounds/equip_sound.wav';

export const clickSound = new Howl({
  src: clickAudio,
  volume: 0.5,
});

export const equipSound = new Howl({
  src: equipAudio,
  volume: 0.5,
});
