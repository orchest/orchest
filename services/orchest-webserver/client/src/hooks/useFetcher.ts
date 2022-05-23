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
    transform?: (data: FetchedValue) => Data;
  }
) {
  const {
    disableFetchOnMount = false,
    revalidateOnFocus = false,
    transform = (fetchedValue: FetchedValue) =>
      (fetchedValue as unknown) as Data,
    ...fetchParams
  } = React.useMemo(() => {
    return params || {};
  }, [params]);

  const { run, data, setData, error, status } = useAsync<Data>();

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

  const shouldRefetch =
    hasUrlChanged || (revalidateOnFocus && hasBrowserFocusChanged && isFocused);

  const fetchData = React.useCallback(() => {
    if (!url) return;
    return run(
      fetcher<FetchedValue>(url, paramsRef.current).then(transformRef.current)
    );
  }, [run, url]);

  const hasFetchedOnMount = React.useRef(disableFetchOnMount);

  React.useEffect(() => {
    if (!hasFetchedOnMount.current || shouldRefetch) {
      hasFetchedOnMount.current = true;
      fetchData();
    }
  }, [fetchData, shouldRefetch]);

  return { data, setData, error, status, fetchData };
}
