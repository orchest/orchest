import { fetcher, hasValue } from "@orchest/lib-utils";
import React from "react";
import { useAsync } from "./useAsync";
import { useFocusBrowserTab } from "./useFocusBrowserTab";
import { useHasChanged } from "./useHasChanged";

export type UseFetcherParams<
  FetchedValue,
  Data = FetchedValue
> = RequestInit & {
  disableFetchOnMount?: boolean;
  revalidateOnFocus?: boolean;
  transform?: (data: FetchedValue) => Data | Promise<Data>;
  disableCaching?: boolean;
};

export function useFetcher<FetchedValue, Data = FetchedValue>(
  url: string | undefined,
  params?: UseFetcherParams<FetchedValue, Data>
) {
  const {
    disableFetchOnMount,
    revalidateOnFocus = false,
    transform = (fetchedValue: FetchedValue) =>
      (fetchedValue as unknown) as Data,
    disableCaching = false,
    ...fetchParams
  } = React.useMemo(() => {
    return params || {};
  }, [params]);

  const { run, data, setData, error, status } = useAsync<Data>({
    disableCaching,
  });

  const transformRef = React.useRef(transform);
  React.useEffect(() => {
    transformRef.current = transform;
  }, [transform]);

  const paramsRef = React.useRef(fetchParams);
  React.useEffect(() => {
    paramsRef.current = fetchParams;
  }, [fetchParams]);

  const isFocused = useFocusBrowserTab(!revalidateOnFocus);
  const hasBrowserFocusChanged = useHasChanged(isFocused);

  const shouldReFetch =
    revalidateOnFocus && hasBrowserFocusChanged && isFocused;

  const fetchData = React.useCallback(
    async (newUrl?: unknown): Promise<void | Data> => {
      const targetUrl = typeof newUrl === "string" ? newUrl || url : url;
      if (!targetUrl) return;
      return run(
        fetcher<FetchedValue>(targetUrl, paramsRef.current).then(
          transformRef.current
        )
      );
    },
    [run, url]
  );

  const urlRef = React.useRef<string>();

  React.useEffect(() => {
    const isMounting =
      !disableFetchOnMount &&
      url &&
      url.length > 0 &&
      urlRef.current === undefined;
    const isUrlChanged = hasValue(urlRef.current) && urlRef.current !== url;
    const isRefetching =
      shouldReFetch && hasValue(urlRef.current) && urlRef.current === url;

    if (isMounting || isUrlChanged || isRefetching) {
      urlRef.current = url;
      fetchData().catch((error) =>
        console.error(`Failed to fetch: ${error.message || "Unknown reason."}`)
      );
    }
  }, [fetchData, url, disableFetchOnMount, shouldReFetch]);

  return { data, setData, error, status, fetchData };
}
