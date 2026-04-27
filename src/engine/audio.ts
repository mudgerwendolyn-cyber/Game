/**
 * SPDX-License-Identifier: Apache-2.0
 */

class AudioManager {
  private sounds: Map<string, HTMLAudioElement> = new Map();
  private voicePool: HTMLAudioElement[] = [];
  private readonly MAX_VOICES = 8;
  private bgm: HTMLAudioElement | null = null;
  private enabled: boolean = true;
  private bmgVolume: number = 0.2;
  private sfxVolume: number = 0.4;

  constructor() {
    this.preLoad();
    // Pre-allocate voice pool
    for (let i = 0; i < this.MAX_VOICES; i++) {
        this.voicePool.push(new Audio());
    }
  }

  private preLoad() {
    const soundUrls = {
      shoot: 'https://assets.mixkit.co/active_storage/sfx/2568/2568-preview.mp3',
      hit: 'https://assets.mixkit.co/active_storage/sfx/1672/1672-preview.mp3', // Sharper hit
      kill: 'https://assets.mixkit.co/active_storage/sfx/2566/2566-preview.mp3',
      gem: 'https://assets.mixkit.co/active_storage/sfx/2019/2019-preview.mp3',
      upgrade: 'https://assets.mixkit.co/active_storage/sfx/2017/2017-preview.mp3',
      click: 'https://assets.mixkit.co/active_storage/sfx/2569/2569-preview.mp3',
      gameOver: 'https://assets.mixkit.co/active_storage/sfx/131/131-preview.mp3'
    };

    Object.entries(soundUrls).forEach(([name, url]) => {
      const audio = new Audio(url);
      audio.preload = 'auto';
      this.sounds.set(name, audio);
    });
  }

  setVolume(sfx: number, bgm: number) {
    this.sfxVolume = sfx;
    this.bmgVolume = bgm;
    if (this.bgm) this.bgm.volume = bgm;
  }

  playBGM(url: string = 'https://assets.mixkit.co/music/preview/mixkit-games-world-614.mp3') {
    if (!this.enabled) return;
    if (this.bgm) {
      if (this.bgm.src === url) return;
      this.bgm.pause();
    }
    this.bgm = new Audio(url);
    this.bgm.loop = true;
    this.bgm.volume = this.bmgVolume;
    this.bgm.play().catch(() => {
        console.log('BGM play blocked');
    });
  }

  playSFX(name: string, pitchVar: number = 0.1) {
    if (!this.enabled) return;
    const original = this.sounds.get(name);
    if (original) {
      // Find an available voice in the pool
      const voice = this.voicePool.find(v => v.paused || v.ended);
      if (voice) {
          voice.src = original.src;
          voice.volume = this.sfxVolume;
          voice.playbackRate = 1 + (Math.random() * pitchVar * 2 - pitchVar);
          voice.play().catch(() => {});
      }
    }
  }

  toggle(val?: boolean) {
    this.enabled = val !== undefined ? val : !this.enabled;
    if (!this.enabled && this.bgm) {
      this.bgm.pause();
    } else if (this.enabled && this.bgm) {
      this.bgm.play().catch(() => {});
    }
  }
}

export const audio = new AudioManager();
