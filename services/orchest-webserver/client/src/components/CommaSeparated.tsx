import React from "react";

export type CommaSeparatedProps<T> = {
  items: readonly T[];
  children: (item: T) => React.ReactNode;
};

/** A helper for creating comma-separated lists. */
export function CommaSeparated<T>({ items, children }: CommaSeparatedProps<T>) {
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
