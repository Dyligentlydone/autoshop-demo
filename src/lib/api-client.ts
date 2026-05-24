import type { ApiResponse } from '@/types';

type ApiClientOptions = {
  baseUrl?: string;
};

export class ApiError extends Error {
  status: number;
  payload: unknown;

  constructor(message: string, status: number, payload: unknown) {
    super(message);
    this.status = status;
    this.payload = payload;
  }
}

export const createApiClient = (options: ApiClientOptions = {}) => {
  const baseUrl = options.baseUrl || '';

  const request = async <T>(input: string, init?: RequestInit): Promise<T> => {
    const res = await fetch(`${baseUrl}${input}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...(init?.headers || {}),
      },
    });

    const text = await res.text();
    const payload = text ? JSON.parse(text) : undefined;

    if (!res.ok) {
      const message =
        (payload && typeof payload === 'object' && 'error' in payload && (payload as any).error) ||
        `Request failed (${res.status})`;
      throw new ApiError(String(message), res.status, payload);
    }

    return payload as T;
  };

  return {
    get: <T>(path: string) => request<T>(path, { method: 'GET' }),
    post: <T>(path: string, body?: unknown) =>
      request<T>(path, {
        method: 'POST',
        body: body === undefined ? undefined : JSON.stringify(body),
      }),
    patch: <T>(path: string, body?: unknown) =>
      request<T>(path, {
        method: 'PATCH',
        body: body === undefined ? undefined : JSON.stringify(body),
      }),
    delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
  };
};

export const apiClient = createApiClient();

export const unwrap = <T>(resp: ApiResponse<T>): T => {
  if (!resp.data) {
    throw new ApiError(resp.error || 'Request failed', resp.status, resp);
  }
  return resp.data;
};
