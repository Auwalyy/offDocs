import * as Network from 'expo-network';

type ConnectivityListener = (isOnline: boolean) => void;

const POLL_INTERVAL_MS = 5_000;

/**
 * `isInternetReachable` is often `null`/unknown (emulators, some Android
 * builds, LAN-only dev setups). Treat the device as online whenever it is
 * connected and reachability has not been explicitly ruled out — the sync
 * engine handles a server that turns out to be unreachable.
 */
function toOnline(state: Network.NetworkState): boolean {
  return state.isConnected === true && state.isInternetReachable !== false;
}

class ConnectivityMonitor {
  private listeners: Set<ConnectivityListener> = new Set();
  private _isOnline = false;
  private pollInterval: ReturnType<typeof setInterval> | null = null;

  async initialize(): Promise<void> {
    try {
      this._isOnline = toOnline(await Network.getNetworkStateAsync());
    } catch {
      this._isOnline = true; // unknown — let sync attempts decide
    }
    this.startPolling();
  }

  get isOnline(): boolean {
    return this._isOnline;
  }

  subscribe(listener: ConnectivityListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private startPolling(): void {
    if (this.pollInterval) return;
    // expo-network does not provide a native event subscription in all environments.
    this.pollInterval = setInterval(() => {
      Network.getNetworkStateAsync()
        .then((state) => {
          const online = toOnline(state);
          if (online !== this._isOnline) {
            this._isOnline = online;
            this.listeners.forEach((l) => l(online));
          }
        })
        .catch(() => undefined);
    }, POLL_INTERVAL_MS);
  }

  destroy(): void {
    if (this.pollInterval) clearInterval(this.pollInterval);
    this.pollInterval = null;
    this.listeners.clear();
  }
}

export const connectivityMonitor = new ConnectivityMonitor();
