import { Example } from "@/types";
import { memoized, MemoizePending } from "@/utils/promise";
import create from "zustand";
import { examplesApi } from "./examplesApi";

export type ExamplesApi = {
  examples: Example[] | undefined;
  fetchAll: MemoizePending<() => Promise<void>>;
};

export const useExamplesApi = create<ExamplesApi>((set) => {
  return {
    examples: undefined,
    fetchAll: memoized(async () => {
      const examples = await examplesApi.fetchAll();

      set({ examples });
    }),
  };
});
