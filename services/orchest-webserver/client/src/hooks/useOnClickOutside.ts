import React from "react";

const isClickingOnRef = <T extends HTMLElement>(
  ref: React.RefObject<T | undefined>,
  event: Event
) => ref.current && ref.current.contains(event.target as Node);

export const useOnClickOutside = <T extends HTMLElement>(
  refs: React.RefObject<T | undefined> | React.RefObject<T | undefined>[],
  callback: (event: TouchEvent | MouseEvent) => void
) => {
  React.useEffect(() => {
    const handler = (event: MouseEvent | TouchEvent) => {
      if (Array.isArray(refs)) {
        const isClickingOnRefs = refs.some((ref) =>
          isClickingOnRef(ref, event)
        );
        if (!isClickingOnRefs) callback(event);
      } else {
        if (!isClickingOnRef(refs, event)) callback(event);
      }
    };

    document.addEventListener("mousedown", handler);
    document.addEventListener("touchstart", handler);

    return () => {
      document.removeEventListener("mousedown", handler);
      document.removeEventListener("touchstart", handler);
    };
  }, [refs, callback]);
};
