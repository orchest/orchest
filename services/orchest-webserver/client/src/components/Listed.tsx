import React from "react";

export type ListedProps<T> = {
  items: readonly T[];
  children: (item: T) => React.ReactNode;
};

/** A helper for creating comma-separated lists. */
export function Listed<T>({ items, children }: ListedProps<T>) {
  return (
    <>
      {items.map((item, index) => (
        <React.Fragment key={index}>
          {children(item)}
          {index === items.length - 1 ? "" : ", "}
        </React.Fragment>
      ))}
    </>
  );
}
