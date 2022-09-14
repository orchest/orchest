import { useRequiredScope } from "@/hooks/useRequiredScope";
import { equalsShallow } from "@/utils/record";
import create, { StoreApi, UseBoundStore } from "zustand";

export type Scope = "projectUuid" | "jobUuid";
export type ScopeValues<S extends Scope> = Record<S, string>;
export type WithScopes<T, S extends Scope> = T & ScopeValues<S>;
export type WithInitialScope<T, S extends Scope> = T & Partial<ScopeValues<S>>;
export type Keyed = Record<string, unknown>;

export type StateSetter<T> = (
  state: Partial<T> | ((prev: T) => Partial<T>)
) => void;

export type ScopedStateCreator<T extends Keyed, S extends Scope> = (
  setState: StateSetter<WithScopes<T, S>>,
  getState: () => WithScopes<T, S>
) => T;

export type UseScopedStore<T extends Keyed, S extends Scope> = {
  /** The scope for which the store is valid within. */
  scope: readonly S[];
  (): T;
  <U>(selector: (state: T) => U, equals?: (a: U, b: U) => boolean): U;
} & StoreApi<WithInitialScope<T, S>>;

/**
 * Creates a zustand store that is bound to the current project.
 * The store is reset to its initial state if the user switches projects.
 */
export const createProjectStore = <T extends Keyed>(
  stateCreator: ScopedStateCreator<T, "projectUuid">
) => createScoped(["projectUuid"], stateCreator);

/**
 * Creates a zustand store that is bound to the current job.
 * The store is reset to its initial state if the user switches between jobs.
 *
 * Calling the returned hook when a `job_uuid` is not available in the URL
 * will throw an error, but calling
 */
export const createJobStore = <T extends Keyed>(
  stateCreator: ScopedStateCreator<T, "jobUuid">
) => createScoped(["jobUuid"], stateCreator);

/**
 * Creates a zustand store that is bound to a specific scope.
 * If the scope changes, the store is reset to its initial state.
 *
 * Calling the returned hook in a context where the scope is not available will throw an error.
 * Calling `.getState` (or `.setState`) works in all contexts, but scoped parameters may be unavailable.
 */
export default function createScoped<T extends Keyed, S extends Scope>(
  scope: readonly S[],
  stateCreator: ScopedStateCreator<T, S>
): UseScopedStore<T, S> {
  const store: UseBoundStore<StoreApi<WithInitialScope<T, S>>> = create(
    stateCreator as never
  );
  const initialState = store.getState();

  function useScopedStore<U>(
    selector?: (state: WithScopes<T, S>) => U,
    equals?: (a: U, b: U) => boolean
  ) {
    const scopeParameters = useRequiredScope(scope);
    const scopeChanged = !equalsShallow(scopeParameters, store.getState());

    if (scopeChanged) {
      store.setState({ ...initialState, ...scopeParameters });
    }

    if (selector) {
      return store(selector as never, equals);
    } else {
      return store();
    }
  }

  return Object.assign(useScopedStore, {
    subscribe: store.subscribe,
    setState: store.setState,
    destroy: store.destroy,
    getState: store.getState,
    scope,
  });
}
