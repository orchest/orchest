import fetch from "isomorphic-unfetch";

export const fetcher = (input, init) =>
  fetch(input, init).then((res) => {
    if (res.status >= 299) {
      throw res;
    }
    return res.json();
  });
