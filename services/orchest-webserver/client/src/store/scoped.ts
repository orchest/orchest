import { useScopeParameters } from "@/hooks/useScopeParameters";
import { ScopeParameter } from "@/types";
import { equalsShallow, pick, prune } from "@/utils/record";
import { assertInScope } from "@/utils/scope";
import create, { StoreApi } from "zustand";

export type Keyed = Record<string, unknown>;
export type WithScopes<
  T extends Keyed,
  S extends ScopeParameter,
  A extends Exclude<ScopeParameter, S> = never
> = T & Record<S, string> & Record<A, string | undefined>;

export type WithInitialScope<
  T extends Keyed,
  S extends ScopeParameter,
  A extends Exclude<ScopeParameter, S> = never
> = T & Record<S, string | undefined> & Record<A, string | undefined>;

export type StateSetter<T> = (
  state: Partial<T> | ((prev: T) => Partial<T>)
) => void;

export type ScopedStateCreator<
  T extends Keyed,
  S extends ScopeParameter,
  A extends Exclude<ScopeParameter, S> = never
> = (
  setState: StateSetter<WithScopes<T, S, A>>,
  getState: () => WithScopes<T, S, A>
) => T;

export type UseScopedStore<
  T extends Keyed,
  S extends ScopeParameter,
  A extends Exclude<ScopeParameter, S> = never
> = StoreApi<WithInitialScope<T, S, A>> & {
  (): WithScopes<T, S, A>;
  <U>(
    selector: (state: WithScopes<T, S, A>) => U,
    equals?: (a: U, b: U) => boolean
  ): U;
};

export type ScopeDefinition<
  S extends ScopeParameter,
  A extends Exclude<ScopeParameter, S> = never
> = {
  /**
   * Required scope parameters to add and track within the state.
   * These parameters will always have a value set when the store is accessed.
   *
   * Note: The store may only be accessed once all these parameters are available.
   * Attempting to access the store outside its required scope throws an error.
   */
  requires: S[];
  /**
   * Additional scope parameters to add to and track within the state.
   *
   * These parameters may not be available within the scope
   * in which case they are `undefined` within the state.
   */
  additional?: A[] | undefined;
};

/** Creates a zustand store that is scoped to the active project. */
export const createProjectStore = defineStoreScope({
  requires: ["projectUuid"],
});

/** Creates a zustand store that is scoped to the active job. */
export const createJobStore = defineStoreScope({ requires: ["jobUuid"] });

/**
 * Returns a function which creates a store within a desired scope.
 *
 * @see createScopedStore
 * @param definition Defines the scope for the store.
 */
export function defineStoreScope<
  S extends ScopeParameter,
  A extends Exclude<ScopeParameter, S> = never
>(definition: ScopeDefinition<S, A>) {
  /**
   * Creates a zustand store which binds the defined scope parameters.
   * The store is reset to its initial state if any required scope parameter changes.
   *
   * Note: Calling the returned hook in a context where the required scope parameters are not available throws an error!
   * Calling `.getState` (or `.setState`) works in all contexts, but the required scoped parameters may be unavailable.
   */
  const create = <T extends Keyed>(createState: ScopedStateCreator<T, S, A>) =>
    createScopedStore<T, S, A>(definition, createState);

  return create;
}

/**
 * Creates a zustand store which binds the specified scope parameters to the state.
 * The store is reset to its initial state if any required scope parameter changes.
 *
 * Note: Calling the returned hook in a context where the required scope parameters are not available throws an error!
 * Calling `.getState` (or `.setState`) works in all contexts, but the required scoped parameters may be unavailable.
 */
export function createScopedStore<
  T extends Keyed,
  S extends ScopeParameter,
  A extends Exclude<ScopeParameter, S> = never
>(
  { requires, additional = [] }: ScopeDefinition<S, A>,
  stateCreator: ScopedStateCreator<T, S, A>
): UseScopedStore<T, S, A> {
  const store = create<WithInitialScope<T, S, A>>(stateCreator as never);
  const initialState = store.getState();

  function useScopedStore<U>(
    selector?: (state: WithScopes<T, S, A>) => U,
    equals?: (a: U, b: U) => boolean
  ) {
    const scopeParameters = useScopeParameters();

    // Prune nullish values from the required parameters:
    // We don't want to reset the store until NEW values are set.
    const state = store.getState();
    const required = prune(pick(scopeParameters, ...requires));
    const extra = pick(scopeParameters, ...additional);

    if (!equalsShallow(required, state)) {
      assertInScope(required, requires);

      store.setState({ ...initialState, ...required, ...extra });
    } else if (!equalsShallow(extra, state)) {
      store.setState({ ...state, ...extra });
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
  });
}
