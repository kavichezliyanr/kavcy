export interface WebGpuStatus {
  supported: boolean;
  adapterName: string;
  maxBufferMb: number;
  notes: string;
}

export async function detectWebGpuStatus(): Promise<WebGpuStatus> {
  const nav = navigator as Navigator & {
    gpu?: {
      requestAdapter: () => Promise<{
        info?: { vendor?: string; architecture?: string; description?: string };
        limits?: { maxBufferSize?: number };
      } | null>;
    };
  };

  if (!nav.gpu) {
    return {
      supported: false,
      adapterName: 'Unavailable',
      maxBufferMb: 0,
      notes: 'WebGPU is not enabled in this browser. Use Local Ollama Bridge or Direct-to-TEE instead.',
    };
  }

  try {
    const adapter = await nav.gpu.requestAdapter();
    if (!adapter) {
      return {
        supported: false,
        adapterName: 'No GPU Adapter',
        maxBufferMb: 0,
        notes: 'No hardware WebGPU adapter exposed.',
      };
    }
    const info = adapter.info || {};
    const name = [info.vendor, info.architecture, info.description].filter(Boolean).join(' · ') || 'Hardware WebGPU Adapter';
    const maxBufferMb = Math.round((adapter.limits?.maxBufferSize || 256 * 1024 * 1024) / (1024 * 1024));
    return {
      supported: true,
      adapterName: name,
      maxBufferMb,
      notes: 'WebGPU ready for opt-in in-browser 1B–3B quantized inference (weights are never auto-downloaded).',
    };
  } catch {
    return {
      supported: false,
      adapterName: 'Blocked',
      maxBufferMb: 0,
      notes: 'WebGPU adapter request was blocked.',
    };
  }
}
