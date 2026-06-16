let audioContext: AudioContext | null = null;
let muted = false;

function ctx(): AudioContext {
  if (!audioContext) {
    audioContext = new AudioContext();
  }
  return audioContext;
}

export function setMuted(value: boolean): void {
  muted = value;
}

export function isMuted(): boolean {
  return muted;
}

function tone(
  frequency: number,
  duration: number,
  type: OscillatorType = 'square',
  gain = 0.05,
): void {
  if (muted) return;
  const ac = ctx();
  const oscillator = ac.createOscillator();
  const gainNode = ac.createGain();
  oscillator.type = type;
  oscillator.frequency.value = frequency;
  gainNode.gain.value = gain;
  oscillator.connect(gainNode);
  gainNode.connect(ac.destination);
  oscillator.start();
  oscillator.stop(ac.currentTime + duration);
}

export function playFire(): void {
  tone(220, 0.08, 'triangle', 0.04);
}

export function playMiss(): void {
  tone(120, 0.15, 'sine', 0.03);
}

export function playHit(): void {
  tone(440, 0.1, 'square', 0.05);
  setTimeout(() => tone(660, 0.08, 'square', 0.04), 80);
}

export function playSink(): void {
  [500, 400, 300, 200].forEach((freq, i) => {
    setTimeout(() => tone(freq, 0.12, 'sawtooth', 0.04), i * 90);
  });
}

export function playWin(): void {
  [523, 659, 784, 1047].forEach((freq, i) => {
    setTimeout(() => tone(freq, 0.15, 'triangle', 0.05), i * 120);
  });
}

export function playLose(): void {
  [392, 330, 262, 196].forEach((freq, i) => {
    setTimeout(() => tone(freq, 0.18, 'sine', 0.04), i * 140);
  });
}

export function resumeAudio(): void {
  void ctx().resume();
}
