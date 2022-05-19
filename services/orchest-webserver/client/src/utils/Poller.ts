import { FetchError, hasValue } from "@orchest/lib-utils";

export type PollerCallbackProps<D, E = FetchError> =
  | {
      status: "fulfilled";
      data: D;
      cancel: () => void;
    }
  | {
      status: "rejected";
      error: E;
      retry: () => void;
    };

export type PollerCallback<D, E> = (props: PollerCallbackProps<D, E>) => void;

export const Poller = (timeInMilliSeconds = 2000) => {
  let eventRecords: Record<string, { reject: (reason?: unknown) => void }> = {};
  const removeEvent = (intervalId: number) => {
    if (hasValue(eventRecords[intervalId])) {
      window.clearInterval(intervalId);
      delete eventRecords[intervalId];
    }
  };

  async function delayedResolve<D, E>(
    getPromise: () => Promise<D>,
    callback?: PollerCallback<D, E>
  ) {
    return new Promise<D>((resolve, reject) => {
      let intervalId = window.setInterval(async () => {
        try {
          const resolved = await getPromise();

          if (callback)
            callback({
              status: "fulfilled",
              data: resolved,
              cancel: () => {
                // cancel polling
                // resolve the outer Promise with the last resolved value
                resolve(resolved);
                removeEvent(intervalId);
              },
            });
        } catch (error) {
          removeEvent(intervalId);
          if (callback)
            callback({
              status: "rejected",
              error: error as E,
              retry: () => delayedResolve(getPromise, callback),
            });
          reject({
            error,
            retry: () => delayedResolve(getPromise, callback),
          });
        }
      }, timeInMilliSeconds);
      eventRecords[intervalId] = { reject };
    });
  }

  return {
    add: <D, E = unknown>(
      getPromise: () => Promise<D>,
      callback?: PollerCallback<D, E>
    ) => {
      return delayedResolve(getPromise, callback);
    },
    isIdling: () => {
      return Object.keys(eventRecords).length === 0;
    },
    clean: (remainingTimeouts?: number[]) => {
      Object.keys(eventRecords).forEach((intervalIdAsString) => {
        const promise = eventRecords[intervalIdAsString];
        promise.reject();
        const intervalId = Number(intervalIdAsString);
        if (!remainingTimeouts?.includes(intervalId)) {
          window.clearInterval(Number(intervalId));
          delete eventRecords[intervalIdAsString];
        }
      });
    },
  };
};
