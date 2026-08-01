interface ApiErrorBody {
  error?: {
    code?: string;
    message?: string;
    fields?: Record<string, string>;
  };
}

export class ApiError extends Error {
  code: string;
  status: number;
  fields: Record<string, string>;

  constructor(status: number, body: ApiErrorBody) {
    super(body.error?.message || "JobFinder could not complete the request.");
    this.name = "ApiError";
    this.code = body.error?.code || "API_ERROR";
    this.status = status;
    this.fields = body.error?.fields || {};
  }
}

export async function apiRequest<T>(
  pathname: string,
  options: RequestInit = {},
): Promise<T> {
  const isFormData = options.body instanceof FormData;
  const response = await fetch(`/api${pathname}`, {
    ...options,
    credentials: "include",
    headers: {
      ...(!isFormData && options.body
        ? { "content-type": "application/json" }
        : {}),
      ...options.headers,
    },
  });

  const body = response.status === 204 ? null : await response.json();
  if (!response.ok) {
    throw new ApiError(response.status, body || {});
  }
  return body as T;
}
