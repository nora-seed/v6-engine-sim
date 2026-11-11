export class EngineSound {
  private ctx: AudioContext;
  private masterGain: GainNode;
  private fundamental: OscillatorNode;
  private harmonics: OscillatorNode[] = [];
  private harmonicGains: GainNode[] = [];
  private intakeNoise: AudioBufferSourceNode | null = null;
  private exhaustNoise: AudioBufferSourceNode | null = null;
  private turboWhistle: OscillatorNode | null = null;
  private turboGain: GainNode | null = null;
  private blowOffGain: GainNode | null = null;
  private blowOffBuffer: AudioBuffer | null = null;
  private rpm = 800;
  private targetRpm = 800;
  private throttle = 0;
  private boost = 0;
  private prevBoost = 0;
  private cylinders = 6;
  private firingOrder = [0, 5, 4, 3, 2, 1];
  private isPlaying = false;

  constructor() {
    this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = 0.35;
    this.masterGain.connect(this.ctx.destination);

    this.fundamental = this.ctx.createOscillator();
    this.fundamental.type = 'sawtooth';
    this.fundamental.frequency.value = this.calcFundamental();
    this.fundamental.connect(this.masterGain);

    const harmonicRatios = [0.5, 1, 1.5, 2, 2.5, 3, 4, 5, 6, 8];
    const harmonicAmps = [0.15, 1.0, 0.6, 0.35, 0.2, 0.12, 0.08, 0.05, 0.03, 0.015];

    harmonicRatios.forEach((ratio, i) => {
      const osc = this.ctx.createOscillator();
      osc.type = ratio <= 2 ? 'sawtooth' : 'triangle';
      osc.frequency.value = this.calcFundamental() * ratio;
      const gain = this.ctx.createGain();
      gain.gain.value = harmonicAmps[i] * 0.15;
      osc.connect(gain).connect(this.masterGain);
      this.harmonics.push(osc);
      this.harmonicGains.push(gain);
    });

    this.createIntakeNoise();
    this.createExhaustNoise();

    this.turboWhistle = this.ctx.createOscillator();
    this.turboWhistle.type = 'sine';
    this.turboWhistle.frequency.value = 2000;
    this.turboGain = this.ctx.createGain();
    this.turboGain.gain.value = 0;
    this.turboWhistle.connect(this.turboGain).connect(this.masterGain);

    this.blowOffGain = this.ctx.createGain();
    this.blowOffGain.gain.value = 0;
    this.loadBlowOffSound();

    this.fundamental.start();
    this.harmonics.forEach(o => o.start());
    this.turboWhistle.start();
  }

  private calcFundamental(): number {
    return (this.rpm / 60) * (this.cylinders / 2);
  }

  private createIntakeNoise(): void {
    const bufferSize = 2 * this.ctx.sampleRate;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(i / bufferSize, 0.5);
    }
    this.intakeNoise = this.ctx.createBufferSource();
    this.intakeNoise.buffer = buffer;
    this.intakeNoise.loop = true;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 180;
    filter.Q.value = 3;
    const gain = this.ctx.createGain();
    gain.gain.value = 0.02;
    this.intakeNoise.connect(filter).connect(gain).connect(this.masterGain);
    this.intakeNoise.start();
  }

  private createExhaustNoise(): void {
    const bufferSize = 2 * this.ctx.sampleRate;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * 0.7;
    }
    this.exhaustNoise = this.ctx.createBufferSource();
    this.exhaustNoise.buffer = buffer;
    this.exhaustNoise.loop = true;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = 80;
    const gain = this.ctx.createGain();
    gain.gain.value = 0.04;
    this.exhaustNoise.connect(filter).connect(gain).connect(this.masterGain);
    this.exhaustNoise.start();
  }

  private async loadBlowOffSound(): Promise<void> {
    const duration = 0.15;
    const sampleRate = this.ctx.sampleRate;
    const buffer = this.ctx.createBuffer(1, duration * sampleRate, sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < buffer.length; i++) {
      const t = i / sampleRate;
      const freq = 800 + 1200 * (1 - t / duration);
      data[i] = Math.sin(2 * Math.PI * freq * t) * Math.exp(-t * 30) * (Math.random() * 0.3 + 0.7);
    }
    this.blowOffBuffer = buffer;
  }

  setRPM(rpm: number): void {
    this.targetRpm = rpm;
  }

  setThrottle(throttle: number): void {
    this.throttle = throttle;
  }

  setBoost(boost: number): void {
    this.prevBoost = this.boost;
    this.boost = boost;

    if (this.prevBoost > 0.3 && this.throttle < 0.2 && boost < this.prevBoost * 0.5) {
      this.triggerBlowOff();
    }
  }

  private triggerBlowOff(): void {
    if (!this.blowOffBuffer || !this.blowOffGain) return;
    const src = this.ctx.createBufferSource();
    src.buffer = this.blowOffBuffer;
    const gain = this.ctx.createGain();
    gain.gain.value = 0.4;
    src.connect(gain).connect(this.masterGain);
    src.start();
  }

  update(dt: number): void {
    if (!this.isPlaying) return;

    const rpmDiff = this.targetRpm - this.rpm;
    this.rpm += rpmDiff * Math.min(1, dt * 3);

    const fundFreq = this.calcFundamental();
    this.fundamental.frequency.setTargetAtTime(fundFreq, this.ctx.currentTime, 0.05);

    this.harmonics.forEach((osc, i) => {
      const ratio = i === 0 ? 0.5 : i === 1 ? 1 : i === 2 ? 1.5 : i === 3 ? 2 : i + 1;
      osc.frequency.setTargetAtTime(fundFreq * ratio, this.ctx.currentTime, 0.05);
    });

    const loadFactor = 0.15 + 0.85 * this.throttle;
    this.masterGain.gain.setTargetAtTime(0.25 * loadFactor, this.ctx.currentTime, 0.1);

    this.harmonicGains.forEach((gain, i) => {
      const base = [0.15, 1.0, 0.6, 0.35, 0.2, 0.12, 0.08, 0.05, 0.03, 0.015][i];
      const loadBoost = i >= 3 ? this.throttle * 0.5 : 0;
      gain.gain.setTargetAtTime(base * 0.15 * (1 + loadBoost), this.ctx.currentTime, 0.1);
    });

    if (this.turboWhistle && this.turboGain) {
      const whistleFreq = 1500 + this.boost * 2000 + this.rpm * 0.8;
      this.turboWhistle.frequency.setTargetAtTime(whistleFreq, this.ctx.currentTime, 0.1);
      const whistleGain = Math.min(0.15, this.boost * 0.12 + this.throttle * 0.05);
      this.turboGain.gain.setTargetAtTime(whistleGain, this.ctx.currentTime, 0.1);
    }
  }

  resume(): void {
    if (this.ctx.state === 'suspended') this.ctx.resume();
    this.isPlaying = true;
  }

  pause(): void {
    this.isPlaying = false;
  }

  setMasterVolume(vol: number): void {
    this.masterGain.gain.value = Math.max(0, Math.min(1, vol)) * 0.35;
  }

  destroy(): void {
    this.fundamental.stop();
    this.harmonics.forEach(o => o.stop());
    this.turboWhistle?.stop();
    this.intakeNoise?.stop();
    this.exhaustNoise?.stop();
    this.ctx.close();
  }
}