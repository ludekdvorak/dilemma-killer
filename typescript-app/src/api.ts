import type {
  AuthResponse,
  CardResult,
  DiceResult,
  GameSummary,
  Player,
  PublicConfig,
  SavedPlayer,
  SpinResult,
  UserProfile,
  UserStatistics,
} from '../shared/contracts';

const API_BASE = '/api';

export class ApiRequestError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
  ) {
    super(message);
    this.name = 'ApiRequestError';
  }
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'DELETE';
  body?: unknown;
  signal?: AbortSignal;
  timeoutMs?: number;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const controller = new AbortController();
  let timedOut = false;
  const abortFromCaller = () => controller.abort();
  if (options.signal?.aborted) controller.abort();
  else options.signal?.addEventListener('abort', abortFromCaller, { once: true });
  const timeout = globalThis.setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, options.timeoutMs ?? 15_000);

  try {
    const response = await fetch(`${API_BASE}${path}`, {
      method: options.method ?? 'GET',
      headers,
      credentials: 'same-origin',
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      signal: controller.signal,
    });

    if (!response.ok) {
      let message = `Request failed (${response.status})`;
      try {
        const data = await response.json() as { message?: string };
        if (data.message) message = data.message;
      } catch {
        // Keep the status-based fallback when the response is not JSON.
      }
      throw new ApiRequestError(message, response.status);
    }

    if (response.status === 204) return undefined as T;
    return await response.json() as T;
  } catch (caught) {
    if (caught instanceof ApiRequestError) throw caught;
    if (options.signal?.aborted) throw new DOMException('Request aborted', 'AbortError');
    if (timedOut) throw new ApiRequestError('The server took too long to respond');
    throw new ApiRequestError('Cannot reach the server');
  } finally {
    globalThis.clearTimeout(timeout);
    options.signal?.removeEventListener('abort', abortFromCaller);
  }
}

export const register = (email: string, password: string, displayName: string, signal?: AbortSignal) =>
  request<AuthResponse>('/auth/register', {
    method: 'POST',
    body: { email, password, displayName },
    signal,
  });

export const login = (email: string, password: string, signal?: AbortSignal) =>
  request<AuthResponse>('/auth/login', { method: 'POST', body: { email, password }, signal });

export const logout = () => request<void>('/auth/logout', { method: 'POST' });
export const me = (signal?: AbortSignal) => request<UserProfile>('/auth/me', { signal });
export const upgradeToPremium = () => request<UserProfile>('/auth/upgrade', { method: 'POST' });

export const getSavedPlayers = (signal?: AbortSignal) => request<SavedPlayer[]>('/players', { signal });
export const addSavedPlayer = (name: string) =>
  request<SavedPlayer>('/players', { method: 'POST', body: { name } });
export const deleteSavedPlayer = (id: number) =>
  request<void>(`/players/${id}`, { method: 'DELETE' });

export const getGames = (signal?: AbortSignal) => request<GameSummary[]>('/games', { signal });
export const spinWheel = (players: Player[], signal?: AbortSignal) =>
  request<SpinResult>('/wheel/spin', { method: 'POST', body: players, signal });
export const rollDice = (players: Player[], signal?: AbortSignal) =>
  request<DiceResult>('/games/dice/roll', { method: 'POST', body: players, signal });
export const drawCard = (players: Player[], signal?: AbortSignal) =>
  request<CardResult>('/games/cards/draw', { method: 'POST', body: players, signal });

export const getStatistics = (signal?: AbortSignal) => request<UserStatistics>('/statistics', { signal });
export const getPublicConfig = (signal?: AbortSignal) => request<PublicConfig>('/config', { signal });
