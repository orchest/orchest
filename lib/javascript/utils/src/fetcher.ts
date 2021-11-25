export const fetcher = async <T>(url: RequestInfo, params?: RequestInit) => {
  const response = await fetch(url, params);

  if (!response.ok || response.status >= 299) {
    const jsonResponse = await response.json();

    throw {
      code: response.status,
      message: response.statusText,
      body: jsonResponse.body || jsonResponse,
    };
  }
  return response.json() as Promise<T>;
};
