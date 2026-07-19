export const getBaseUrl = () => {
  const baseUrl = import.meta.env.URL || import.meta.env.VITE_URL || "http://172.168.9.139:3000/";
  return baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;
};

const getHeaders = () => {
  const token = localStorage.getItem("arxiva-auth-token");
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (token) {
    headers["Authorization"] = `${token}`;
  }
  return headers;
};

class APIError extends Error {
  response: any;
  constructor(message: string, response: any) {
    super(message);
    this.response = response;
  }
}

async function request(endpoint: string, options: RequestInit = {}) {
  const url = `${getBaseUrl()}${endpoint.startsWith("/") ? endpoint : `/${endpoint}`}`;
  
  const config = {
    ...options,
    headers: {
      ...getHeaders(),
      ...options.headers,
    },
  };

  const response = await fetch(url, config);
  
  let data;
  const contentType = response.headers.get("content-type");
  
  if (contentType && contentType.includes("application/json")) {
    data = await response.json();
  } else if (contentType && contentType.includes("application/pdf")) {
    data = await response.blob();
  } else {
    data = await response.text();
  }

  if (!response.ok) {
    throw new APIError(data?.message || "API request failed", {
      status: response.status,
      data,
    });
  }

  return { data, status: response.status, headers: response.headers };
}

export const api = {
  get: (endpoint: string, options?: RequestInit) => request(endpoint, { method: "GET", ...options }),
  post: (endpoint: string, data?: any, options?: RequestInit) => request(endpoint, { method: "POST", body: data ? JSON.stringify(data) : undefined, ...options }),
  put: (endpoint: string, data?: any, options?: RequestInit) => request(endpoint, { method: "PUT", body: data ? JSON.stringify(data) : undefined, ...options }),
  delete: (endpoint: string, options?: RequestInit) => request(endpoint, { method: "DELETE", ...options }),
};
