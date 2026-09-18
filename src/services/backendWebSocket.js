import { API_BASE_URL } from './backendApi';

const DEFAULT_WS_URL = `${API_BASE_URL.replace(/^http/, 'ws')}/ws/live`;
const RECONNECT_DELAYS_MS = [1000, 2000, 4000, 8000, 10000];

class BackendWebSocket {
  constructor() {
    this.socket = null;
    this.listeners = new Set();
    this.statusListeners = new Set();
    this.reconnectTimer = null;
    this.reconnectAttempt = 0;
    this.shouldReconnect = false;
  }

  subscribe(onMessage, onStatus) {
    this.listeners.add(onMessage);
    if (onStatus) this.statusListeners.add(onStatus);
    this.shouldReconnect = true;

    if (!this.socket && !this.reconnectTimer) this.connect();
    onStatus?.(this.socket?.readyState === WebSocket.OPEN ? 'LIVE' : 'CONNECTING');

    return () => {
      this.listeners.delete(onMessage);
      if (onStatus) this.statusListeners.delete(onStatus);

      if (this.listeners.size === 0) {
        this.shouldReconnect = false;
        this.clearReconnectTimer();
        this.socket?.close();
        this.socket = null;
      }
    };
  }

  connect() {
    if (!this.shouldReconnect || this.socket) return;

    this.notifyStatus(this.reconnectAttempt > 0 ? 'RECONNECTING' : 'CONNECTING');
    const wsUrl = import.meta.env.VITE_WS_URL || DEFAULT_WS_URL;

    try {
      this.socket = new WebSocket(wsUrl);
    } catch (error) {
      this.socket = null;
      this.notifyStatus('OFFLINE', error.message);
      this.scheduleReconnect();
      return;
    }

    this.socket.onopen = () => {
      this.reconnectAttempt = 0;
      this.notifyStatus('LIVE');
    };

    this.socket.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        if (!message || typeof message !== 'object' || typeof message.type !== 'string') return;
        this.listeners.forEach((listener) => listener(message));
      } catch {
        // Ignore malformed backend messages without taking down the dashboard.
      }
    };

    this.socket.onerror = () => {
      this.notifyStatus('OFFLINE', 'WebSocket connection error');
    };

    this.socket.onclose = () => {
      this.socket = null;
      if (this.shouldReconnect) {
        this.notifyStatus('RECONNECTING');
        this.scheduleReconnect();
      } else {
        this.notifyStatus('OFFLINE');
      }
    };
  }

  scheduleReconnect() {
    if (!this.shouldReconnect || this.reconnectTimer) return;

    const delay = RECONNECT_DELAYS_MS[Math.min(this.reconnectAttempt, RECONNECT_DELAYS_MS.length - 1)];
    this.reconnectAttempt += 1;
    this.reconnectTimer = window.setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, delay);
  }

  clearReconnectTimer() {
    if (this.reconnectTimer) {
      window.clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  notifyStatus(status, error = null) {
    this.statusListeners.forEach((listener) => listener(status, error));
  }
}

export const backendWebSocket = new BackendWebSocket();
