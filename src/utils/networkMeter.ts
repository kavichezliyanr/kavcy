export interface NetworkEvent {
  id: string;
  timestamp: string;
  method: string;
  host: string;
  path: string;
  scope: 'local' | 'external' | 'blocked';
  bytesOut: number;
  status?: number;
}

export interface NetworkMeterSnapshot {
  airGapEnabled: boolean;
  externalBytes: number;
  localBytes: number;
  externalRequests: number;
  localRequests: number;
  blockedRequests: number;
  events: NetworkEvent[];
}

type Listener = (snapshot: NetworkMeterSnapshot) => void;

const listeners = new Set<Listener>();
let installed = false;
let state: NetworkMeterSnapshot = {
  airGapEnabled: false,
  externalBytes: 0,
  localBytes: 0,
  externalRequests: 0,
  localRequests: 0,
  blockedRequests: 0,
  events: [],
};

function notify() {
  const copy = { ...state, events: [...state.events] };
  listeners.forEach((fn) => fn(copy));
}

function isLocalUrl(rawUrl: string): boolean {
  try {
    const parsed = new URL(rawUrl, window.location.origin);
    const host = parsed.hostname.toLowerCase();
    return (
      parsed.origin === window.location.origin ||
      host === 'localhost' ||
      host === '127.0.0.1' ||
      host === '::1'
    );
  } catch {
    return true;
  }
}

function estimateBodyBytes(body: BodyInit | null | undefined): number {
  if (!body) return 0;
  if (typeof body === 'string') return new TextEncoder().encode(body).length;
  if (body instanceof Blob) return body.size;
  if (body instanceof ArrayBuffer) return body.byteLength;
  if (ArrayBuffer.isView(body)) return body.byteLength;
  return 0;
}

export function installNetworkMeter() {
  if (installed || typeof window === 'undefined') return;
  installed = true;
  const nativeFetch = window.fetch.bind(window);

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const rawUrl = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    const method = (init?.method || (typeof input === 'object' && 'method' in input ? input.method : 'GET') || 'GET').toUpperCase();
    const bytesOut = estimateBodyBytes(init?.body);
    const parsed = new URL(rawUrl, window.location.origin);
    const local = isLocalUrl(rawUrl);

    if (!local && state.airGapEnabled) {
      state = {
        ...state,
        blockedRequests: state.blockedRequests + 1,
        events: [
          {
            id: crypto.randomUUID(),
            timestamp: new Date().toISOString(),
            method,
            host: parsed.host,
            path: parsed.pathname,
            scope: 'blocked' as const,
            bytesOut: 0,
          },
          ...state.events,
        ].slice(0, 40),
      };
      notify();
      throw new Error(`Air-Gap Mode blocked outbound request to ${parsed.host}`);
    }

    const event: NetworkEvent = {
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      method,
      host: parsed.host,
      path: parsed.pathname,
      scope: local ? 'local' : 'external',
      bytesOut,
    };

    state = {
      ...state,
      localBytes: local ? state.localBytes + bytesOut : state.localBytes,
      externalBytes: local ? state.externalBytes : state.externalBytes + bytesOut,
      localRequests: local ? state.localRequests + 1 : state.localRequests,
      externalRequests: local ? state.externalRequests : state.externalRequests + 1,
      events: [event, ...state.events].slice(0, 40),
    };
    notify();

    const response = await nativeFetch(input, init);
    event.status = response.status;
    notify();
    return response;
  };
}

export function setAirGapMode(enabled: boolean) {
  state = { ...state, airGapEnabled: enabled };
  notify();
}

export function resetNetworkMeter() {
  state = {
    ...state,
    externalBytes: 0,
    localBytes: 0,
    externalRequests: 0,
    localRequests: 0,
    blockedRequests: 0,
    events: [],
  };
  notify();
}

export function subscribeNetworkMeter(listener: Listener): () => void {
  listeners.add(listener);
  listener({ ...state, events: [...state.events] });
  return () => listeners.delete(listener);
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}
