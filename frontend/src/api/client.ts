export const API_BASE_URL =
  import.meta.env.VITE_API_URL || 'https://odu8ihixga.execute-api.ap-south-1.amazonaws.com';

export interface ApiError {
  code: string;
  message: string;
}

export async function apiRequest<T = unknown>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = localStorage.getItem('carecircle_token');
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const url = `${API_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`;
  const res = await fetch(url, {
    ...options,
    headers,
  });

  const data = await res.json().catch(() => null);

  if (!res.ok) {
    const errorMsg = data?.error?.message || data?.message || `HTTP error ${res.status}`;
    const code = data?.error?.code || 'ERROR';
    const err = new Error(errorMsg) as Error & { code?: string; status?: number };
    err.code = code;
    err.status = res.status;
    throw err;
  }

  return data;
}
