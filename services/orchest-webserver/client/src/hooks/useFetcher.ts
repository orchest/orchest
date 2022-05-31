import { fetcher } from "@orchest/lib-utils";
import React from "react";
import { useAsync } from "./useAsync";
import { useFocusBrowserTab } from "./useFocusBrowserTab";
import { useHasChanged } from "./useHasChanged";

export function useFetcher<FetchedValue, Data = FetchedValue>(
  url: string | undefined,
  params?: RequestInit & {
    disableFetchOnMount?: boolean;
    revalidateOnFocus?: boolean;
    transform?: (data: FetchedValue) => Data | Promise<Data>;
    caching?: boolean;
  }
) {
  const {
    disableFetchOnMount,
    revalidateOnFocus = false,
    transform = (fetchedValue: FetchedValue) =>
      (fetchedValue as unknown) as Data,
    caching = false,
    ...fetchParams
  } = React.useMemo(() => {
    return params || {};
  }, [params]);

  const { run, data, setData, error, status } = useAsync<Data>({ caching });

  const transformRef = React.useRef(transform);
  React.useEffect(() => {
    transformRef.current = transform;
  }, [transform]);

  const paramsRef = React.useRef(fetchParams);
  React.useEffect(() => {
    paramsRef.current = fetchParams;
  }, [fetchParams]);

  const isFocused = useFocusBrowserTab();
  const hasBrowserFocusChanged = useHasChanged(isFocused);
  const hasUrlChanged = useHasChanged(url);

  const shouldFetchOnUrlChanges =
    !disableFetchOnMount && hasUrlChanged && url !== "";

  const shouldReFetch =
    revalidateOnFocus && hasBrowserFocusChanged && isFocused;

  const fetchData = React.useCallback((): Promise<Data> | void => {
    if (!url) return;
    return run(
      fetcher<FetchedValue>(url, paramsRef.current).then(transformRef.current)
    );
  }, [run, url]);

  React.useEffect(() => {
    // Either URL changed or browser tab focused should fire fetch.
    // Note that `shouldFetchOnUrlChanges || shouldReFetch` will fire an unnecessary request.
    if (
      (shouldFetchOnUrlChanges && !shouldReFetch) ||
      (!shouldFetchOnUrlChanges && shouldReFetch)
    ) {
      fetchData();
    }
  }, [fetchData, shouldFetchOnUrlChanges, shouldReFetch]);

  return { data, setData, error, status, fetchData };
}
