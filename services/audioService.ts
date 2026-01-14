
export function decodeBase64(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

export function encodeBase64(bytes: Uint8Array): string {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number,
  numChannels: number,
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

export function createPcmBlob(data: Float32Array): string {
  const l = data.length;
  const int16 = new Int16Array(l);
  for (let i = 0; i < l; i++) {
    int16[i] = data[i] * 32768;
  }
  return encodeBase64(new Uint8Array(int16.buffer));
}

/**
 * Adaptive Jitter Buffer to handle network fluctuations
 */
export class JitterBuffer {
  private offset: number = 0.05; // Initial 50ms buffer
  private readonly minOffset = 0.03;
  private readonly maxOffset = 0.25;
  private readonly step = 0.03;
  private stutterCount: number = 0;

  getAdaptiveTime(ctxTime: number, nextStartTime: number): number {
    const scheduled = Math.max(nextStartTime, ctxTime + this.offset);
    
    // Check for underrun/stutter
    if (scheduled < ctxTime + 0.01) {
      this.stutterCount++;
      this.offset = Math.min(this.offset + this.step, this.maxOffset);
      console.warn(`[JitterBuffer] Stutter detected. New offset: ${Math.round(this.offset * 1000)}ms`);
    } else if (this.offset > this.minOffset) {
      // Slowly decay offset back to min
      this.offset -= 0.0005; 
    }
    return scheduled;
  }

  get currentOffsetMs() { return Math.round(this.offset * 1000); }
  get stutters() { return this.stutterCount; }
}

/**
 * Manages low-latency filler audio with ducking capabilities.
 */
export class FillerManager {
  private fillers: AudioBuffer[] = [];
  private ctx: AudioContext;
  private activeSource: AudioBufferSourceNode | null = null;
  private activeGain: GainNode | null = null;

  constructor(ctx: AudioContext) {
    this.ctx = ctx;
  }

  async preloadFillers() {
    const fillerUrls = [
      'https://actions.google.com/sounds/v1/human_voices/shh_low.ogg',
      'https://actions.google.com/sounds/v1/human_voices/vocal_nods_mhm.ogg',
      'https://actions.google.com/sounds/v1/human_voices/vocal_nods_yes.ogg'
    ];
    try {
      const buffers = await Promise.all(
        fillerUrls.map(async (url) => {
          const resp = await fetch(url);
          const arrayBuf = await resp.arrayBuffer();
          return await this.ctx.decodeAudioData(arrayBuf);
        })
      );
      this.fillers = buffers;
    } catch (e) {
      console.warn('Filler assets failed to load.', e);
    }
  }

  playRandomFiller(outputNode: AudioNode) {
    if (this.fillers.length === 0) return;
    this.stopWithFade(0); // Clear any existing

    const buffer = this.fillers[Math.floor(Math.random() * this.fillers.length)];
    const source = this.ctx.createBufferSource();
    const gain = this.ctx.createGain();
    
    source.buffer = buffer;
    source.connect(gain);
    gain.connect(outputNode);
    
    this.activeSource = source;
    this.activeGain = gain;
    
    source.start();
    source.onended = () => {
      if (this.activeSource === source) {
        this.activeSource = null;
        this.activeGain = null;
      }
    };
  }

  stopWithFade(fadeMs: number = 150) {
    if (this.activeGain && this.activeSource) {
      const g = this.activeGain;
      const s = this.activeSource;
      const fadeSeconds = fadeMs / 1000;
      g.gain.linearRampToValueAtTime(0, this.ctx.currentTime + fadeSeconds);
      setTimeout(() => {
        try { s.stop(); } catch {}
      }, fadeMs);
      this.activeSource = null;
      this.activeGain = null;
    }
  }

  get isPlaying() { return this.activeSource !== null; }
}

/**
 * Advanced latency tracking for p50/p95 metrics.
 */
export class LatencyTracker {
  private userStopTs: number = 0;
  private pLatencies: number[] = []; // Perceived (Filler or AI)
  private rLatencies: number[] = []; // Real (AI only)
  private hasRecordedPerceivedForTurn = false;

  recordUserStop() {
    this.userStopTs = performance.now();
    this.hasRecordedPerceivedForTurn = false;
  }

  recordFillerStart(): number | null {
    if (this.userStopTs === 0 || this.hasRecordedPerceivedForTurn) return null;
    const lat = performance.now() - this.userStopTs;
    this.pLatencies.push(lat);
    this.hasRecordedPerceivedForTurn = true;
    return lat;
  }

  recordRealAudioStart(): number | null {
    if (this.userStopTs === 0) return null;
    const lat = performance.now() - this.userStopTs;
    this.rLatencies.push(lat);
    
    if (!this.hasRecordedPerceivedForTurn) {
      this.pLatencies.push(lat);
      this.hasRecordedPerceivedForTurn = true;
    }
    this.userStopTs = 0; // Reset for next turn
    return lat;
  }

  private calculatePercentile(data: number[], p: number) {
    if (data.length === 0) return 0;
    const sorted = [...data].sort((a, b) => a - b);
    const index = Math.ceil(p * sorted.length) - 1;
    return sorted[Math.max(0, index)];
  }

  getStats() {
    return {
      perceived: {
        p50: this.calculatePercentile(this.pLatencies, 0.5),
        p95: this.calculatePercentile(this.pLatencies, 0.95)
      },
      real: {
        p50: this.calculatePercentile(this.rLatencies, 0.5),
        p95: this.calculatePercentile(this.rLatencies, 0.95)
      },
      count: this.rLatencies.length
    };
  }

  clear() {
    this.userStopTs = 0;
    this.pLatencies = [];
    this.rLatencies = [];
  }
}
