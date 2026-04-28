/**
 * SPDX-License-Identifier: Apache-2.0
 */

class AudioManager {
  private context: AudioContext | null = null;
  private compressor: DynamicsCompressorNode | null = null;
  private buffers: Map<string, AudioBuffer> = new Map();
  private lastPlayed: Map<string, number> = new Map();
  private enabled: boolean = true;
  private sfxVolume: number = 0.5;

  constructor() {
    // Audio disabled completely as per user request
    if (typeof window !== 'undefined') {
      // no-op
    }
  }

  private async preLoad() {
    return;
  }

  setVolume(sfx: number, bgm: number) {
    this.sfxVolume = sfx;
    // BGM removed
  }

  playBGM(url?: string) {
    // Disabled BGM implementation
    console.log("BGM playback blocked. If you still hear music, please refresh the page to clear the previous Audio instance.");
    return;
  }

  playSFX(name: string, pitchVar: number = 0.1) {
    return;
  }

  toggle(val?: boolean) {
    this.enabled = val !== undefined ? val : !this.enabled;
  }
}

export const audio = new AudioManager();
