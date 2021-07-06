// @ts-check
import useSWR from "swr";
import { fetcher } from "@/utils/fetcher";

/**
 * @param {import('./types').TUseProjectsOptions} [options]
 */
export const useProjects = ({ shouldFetch }) => {
  /**
   * @type import('./types').TUseProjectsReturn
   */
  const { data, error, ...swr } = useSWR(
    shouldFetch === false ? null : "/async/projects",
    fetcher
  );

  return { isLoading: !data && !error, data, error, ...swr };
};
