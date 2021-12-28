import React from "react";

const isClickingOnRef = <T extends HTMLElement>(
  ref: React.RefObject<T>,
  event: MouseEvent
) => ref.current && ref.current.contains(event.target as Node);

export const useClickOutside = <T extends HTMLElement>(
  refs: React.RefObject<T> | React.RefObject<T>[],
  callback: () => void
) => {
  const handleClickOutside = (event: MouseEvent) => {
    if (Array.isArray(refs)) {
      const isClickingOnRefs = refs.some((ref) => isClickingOnRef(ref, event));
      if (!isClickingOnRefs) callback();
    } else {
      if (!isClickingOnRef(refs, event)) callback();
    }
  };

  React.useEffect(() => {
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);
};
