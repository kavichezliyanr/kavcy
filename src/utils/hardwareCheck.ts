export interface HardwareSpecs {
  source: 'host' | 'browser';
  totalRamGb: number;
  freeRamGb?: number;
  cpuModel: string;
  cpuCores: number;
  gpuRenderer: string;
  platform: string;
  storageFreeGb?: number;
}

export interface LocalModelSpec {
  id: string;
  name: string;
  ollamaTag: string;
  params: string;
  downloadGb: number;
  minRamGb: number;
  recommendedRamGb: number;
  notes: string;
}

export interface EvaluatedModel extends LocalModelSpec {
  compatibility: 'compatible' | 'tight' | 'incompatible';
  reason: string;
}

export const LOCAL_MODEL_CATALOG: LocalModelSpec[] = [
  {
    id: 'llama-3.2-1b',
    name: 'Llama 3.2 1B (Q4)',
    ollamaTag: 'llama3.2:1b',
    params: '1B',
    downloadGb: 1.3,
    minRamGb: 4,
    recommendedRamGb: 6,
    notes: 'Ultra-lightweight; runs smoothly on 4-8 GB laptops & older hardware.',
  },
  {
    id: 'qwen-2.5-3b',
    name: 'Qwen 2.5 3B Instruct (Q4)',
    ollamaTag: 'qwen2.5:3b',
    params: '3B',
    downloadGb: 2.0,
    minRamGb: 6,
    recommendedRamGb: 8,
    notes: 'Best balance of speed and quality for 8 GB Macs & Windows laptops.',
  },
  {
    id: 'gemma-3-4b',
    name: 'Gemma 3 4B (Q4)',
    ollamaTag: 'gemma3:4b',
    params: '4B',
    downloadGb: 3.3,
    minRamGb: 8,
    recommendedRamGb: 12,
    notes: 'Strong reasoning & writing; comfortable on 8-16 GB devices.',
  },
  {
    id: 'llama-3.1-8b',
    name: 'Llama 3.1 8B (Q4)',
    ollamaTag: 'llama3.1:8b',
    params: '8B',
    downloadGb: 4.9,
    minRamGb: 8,
    recommendedRamGb: 16,
    notes: 'Tight on 8 GB RAM (may swap); ideal on 16 GB+ machines.',
  },
  {
    id: 'qwen-2.5-14b',
    name: 'Qwen 2.5 14B (Q4)',
    ollamaTag: 'qwen2.5:14b',
    params: '14B',
    downloadGb: 9.0,
    minRamGb: 16,
    recommendedRamGb: 24,
    notes: 'High-accuracy coding & RAG reasoning; requires 16 GB+ RAM.',
  },
  {
    id: 'deepseek-r1-32b',
    name: 'DeepSeek R1 32B (Q4)',
    ollamaTag: 'deepseek-r1:32b',
    params: '32B',
    downloadGb: 19.8,
    minRamGb: 32,
    recommendedRamGb: 48,
    notes: 'Workstation-class model; requires 32 GB+ unified RAM or 24 GB VRAM.',
  },
];

function detectWebGlRenderer(): string {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    if (!gl) return 'Standard GPU';
    const debugInfo = (gl as WebGLRenderingContext).getExtension('WEBGL_debug_renderer_info');
    if (!debugInfo) return 'WebGL GPU';
    return String((gl as WebGLRenderingContext).getParameter(debugInfo.UNMASKED_RENDERER_WEBGL));
  } catch {
    return 'Unknown GPU';
  }
}

export async function detectHardwareSpecs(): Promise<HardwareSpecs> {
  const gpuRenderer = detectWebGlRenderer();
  let storageFreeGb: number | undefined;
  try {
    if (navigator.storage?.estimate) {
      const est = await navigator.storage.estimate();
      if (est.quota && est.usage !== undefined) {
        storageFreeGb = Number(((est.quota - est.usage) / 1024 ** 3).toFixed(1));
      }
    }
  } catch {
    // ignore
  }

  try {
    const res = await fetch('/api/system-specs');
    if (res.ok) {
      const host = await res.json();
      return {
        source: 'host',
        totalRamGb: host.totalRamGb,
        freeRamGb: host.freeRamGb,
        cpuModel: host.cpuModel,
        cpuCores: host.cpuCores,
        gpuRenderer,
        platform: `${host.platform} (${host.arch})`,
        storageFreeGb,
      };
    }
  } catch {
    // fall back to browser heuristics
  }

  const nav = navigator as Navigator & { deviceMemory?: number };
  return {
    source: 'browser',
    totalRamGb: nav.deviceMemory || 8,
    cpuModel: 'Browser Detected CPU',
    cpuCores: navigator.hardwareConcurrency || 4,
    gpuRenderer,
    platform: navigator.platform || 'Web Device',
    storageFreeGb,
  };
}

export function evaluateModelsForHardware(specs: HardwareSpecs): EvaluatedModel[] {
  return LOCAL_MODEL_CATALOG.map((model) => {
    if (specs.totalRamGb < model.minRamGb) {
      return {
        ...model,
        compatibility: 'incompatible',
        reason: `Blocked: requires at least ${model.minRamGb} GB RAM (detected ${specs.totalRamGb} GB).`,
      };
    }
    if (specs.storageFreeGb !== undefined && specs.storageFreeGb < model.downloadGb + 1) {
      return {
        ...model,
        compatibility: 'incompatible',
        reason: `Blocked: requires ${model.downloadGb} GB disk space (only ~${specs.storageFreeGb} GB available).`,
      };
    }
    if (specs.totalRamGb < model.recommendedRamGb) {
      return {
        ...model,
        compatibility: 'tight',
        reason: `Warning: tight fit on ${specs.totalRamGb} GB RAM (recommended ${model.recommendedRamGb} GB). May use swap.`,
      };
    }
    return {
      ...model,
      compatibility: 'compatible',
      reason: `Compatible with your ${specs.totalRamGb} GB machine.`,
    };
  });
}
