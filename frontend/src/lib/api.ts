interface ApiErrorBody {
  error?: {
    code?: string;
    message?: string;
    fields?: Record<string, string>;
  };
}

const SERVER_UNAVAILABLE_BODY: ApiErrorBody = {
  error: {
    code: "SERVER_UNAVAILABLE",
    message:
      "JobFinder server unavailable. Run npm run dev from the main project folder, then try again.",
  },
};

function isApiErrorBody(value: unknown): value is ApiErrorBody {
  return typeof value === "object" && value !== null;
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
  let response: Response;
  try {
    response = await fetch(`/api${pathname}`, {
      ...options,
      credentials: "include",
      headers: {
        ...(!isFormData && options.body
          ? { "content-type": "application/json" }
          : {}),
        ...options.headers,
      },
    });
  } catch {
    throw new ApiError(0, SERVER_UNAVAILABLE_BODY);
  }

  let body: unknown = null;
  if (response.status !== 204) {
    let responseText: string;
    try {
      responseText = await response.text();
    } catch {
      throw new ApiError(response.status, SERVER_UNAVAILABLE_BODY);
    }

    if (!responseText.trim()) {
      throw new ApiError(response.status, SERVER_UNAVAILABLE_BODY);
    }

    try {
      body = JSON.parse(responseText);
    } catch {
      throw new ApiError(response.status, SERVER_UNAVAILABLE_BODY);
    }
  }

  if (!response.ok) {
    throw new ApiError(
      response.status,
      isApiErrorBody(body) ? body : SERVER_UNAVAILABLE_BODY,
    );
  }
  return body as T;
}
