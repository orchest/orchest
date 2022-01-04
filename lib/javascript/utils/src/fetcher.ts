export const fetcher = async <T>(url: RequestInfo, params?: RequestInit) => {
  const response = await window.fetch(url, params);
  const responseAsString = await response.text();
  const jsonResponse =
    responseAsString === "" ? {} : JSON.parse(responseAsString);

  if (!response.ok || response.status >= 299) {
    return Promise.reject({
      status: response.status,
      message: jsonResponse.message || response.statusText,
    });
  }

  return jsonResponse as Promise<T>;
};
