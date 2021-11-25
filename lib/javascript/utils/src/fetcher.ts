export const fetcher = async <T>(url: RequestInfo, params?: RequestInit) => {
  const response = await window.fetch(url, params);

  if (!response.ok || response.status >= 299) {
    const jsonResponse = await response.json();

    throw {
      code: response.status,
      message: response.statusText,
      body: jsonResponse.body || jsonResponse,
    };
  }

  const responseAsString = await response.text();
  const jsonResponse =
    responseAsString === "" ? {} : JSON.parse(responseAsString);

  return jsonResponse as Promise<T>;
};
