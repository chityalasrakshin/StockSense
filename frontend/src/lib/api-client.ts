const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';

let inMemoryAccessToken: string | null = null;
let isRefreshing = false;
let refreshSubscribers: Array<(token: string | null) => void> = [];

export function getAccessToken(): string | null {
  return inMemoryAccessToken;
}

export function setAccessToken(token: string | null): void {
  inMemoryAccessToken = token;
}

function onTokenRefreshed(token: string | null) {
  refreshSubscribers.forEach((cb) => cb(token));
  refreshSubscribers = [];
}

function addRefreshSubscriber(cb: (token: string | null) => void) {
  refreshSubscribers.push(cb);
}

export interface ApiErrorResponse {
  error: {
    code: string;
    message: string;
    fieldErrors?: Array<{ field: string; message: string }>;
  };
}

export class ApiError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status: number,
    public readonly fieldErrors?: Array<{ field: string; message: string }>,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export async function apiClient<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const url = endpoint.startsWith('http')
    ? endpoint
    : `${BASE_URL}${endpoint.startsWith('/') ? '' : '/'}${endpoint}`;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options?.headers as Record<string, string>),
  };

  if (inMemoryAccessToken && !headers['Authorization'] && !headers['authorization']) {
    headers['Authorization'] = `Bearer ${inMemoryAccessToken}`;
  }

  const fetchOptions: RequestInit = {
    credentials: 'include',
    ...options,
    headers,
  };

  let res = await fetch(url, fetchOptions);

  // If 401 Unauthorized, and not auth login/refresh/signup endpoint, attempt transparent token refresh
  const isAuthEndpoint =
    endpoint.includes('/auth/login') ||
    endpoint.includes('/auth/refresh') ||
    endpoint.includes('/auth/signup') ||
    endpoint.includes('/auth/otp');

  if (res.status === 401 && !isAuthEndpoint) {
    if (!isRefreshing) {
      isRefreshing = true;
      try {
        const refreshRes = await fetch(`${BASE_URL}/auth/refresh`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        });

        if (refreshRes.ok) {
          const data = (await refreshRes.json()) as { accessToken: string };
          setAccessToken(data.accessToken);
          onTokenRefreshed(data.accessToken);
        } else {
          setAccessToken(null);
          onTokenRefreshed(null);
        }
      } catch {
        setAccessToken(null);
        onTokenRefreshed(null);
      } finally {
        isRefreshing = false;
      }
    } else {
      // Wait for existing refresh to complete
      await new Promise<void>((resolve) => {
        addRefreshSubscriber(() => resolve());
      });
    }

    if (inMemoryAccessToken) {
      headers['Authorization'] = `Bearer ${inMemoryAccessToken}`;
      res = await fetch(url, {
        ...fetchOptions,
        headers,
      });
    }
  }

  if (!res.ok) {
    let errorBody: ApiErrorResponse | null = null;
    try {
      errorBody = (await res.json()) as ApiErrorResponse;
    } catch {
      // response wasn't JSON
    }

    if (errorBody?.error) {
      throw new ApiError(
        errorBody.error.code,
        errorBody.error.message,
        res.status,
        errorBody.error.fieldErrors,
      );
    }

    throw new ApiError(
      'HTTP_ERROR',
      `API request failed: ${res.status} ${res.statusText}`,
      res.status,
    );
  }

  return res.json() as Promise<T>;
}
