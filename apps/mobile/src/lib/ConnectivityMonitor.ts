import * as Network from 'expo-network';

type ConnectivityListener = (isOnline: boolean) => void;

class ConnectivityMonitor {
  private listeners: Set<ConnectivityListener> = new Set();
  private _isOnline = false;
  private pollInterval: ReturnType<typeof setInterval> | null = null;

  async initialize(): Promise<void> {
    const state = await Network.getNetworkStateAsync();
    this._isOnline = state.isInternetReachable ?? false;
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
    // expo-network does not provide a native event subscription in all environments.
    // Poll every 5 seconds — lightweight and sufficient for sync triggering.
    this.pollInterval = setInterval(async () => {
      const state = await Network.getNetworkStateAsync();
      const online = state.isInternetReachable ?? false;
      if (online !== this._isOnline) {
        this._isOnline = online;
        this.listeners.forEach((l) => l(online));
      }
    }, 5_000);
  }

  destroy(): void {
    if (this.pollInterval) clearInterval(this.pollInterval);
    this.listeners.clear();
  }
}

export const connectivityMonitor = new ConnectivityMonitor();
