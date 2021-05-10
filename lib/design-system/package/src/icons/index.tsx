import * as React from "react";
import { css } from "../core";
import { ICSSProp } from "../types";

export const icon = css({
  $$iconSize: "1rem",
  width: "$$iconSize",
  height: "$$iconSize",
  verticalAlign: "middle",
  variants: {
    size: {
      "4": {
        $$iconSize: "$space$4",
      },
    },
  },
  defaultVariants: {
    size: "4",
  },
});

export type IIconRef = SVGSVGElement;
export interface IIconProps extends ICSSProp, React.SVGProps<IIconRef> {}

export const IconChevronLeft = React.forwardRef<IIconRef, IIconProps>(
  ({ css, className, ...props }, ref) => (
    <svg
      ref={ref}
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      className={icon({ className, css })}
      {...props}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M15 19l-7-7 7-7"
      />
    </svg>
  )
);

export const IconChevronRight = React.forwardRef<IIconRef, IIconProps>(
  ({ css, className, ...props }, ref) => (
    <svg
      ref={ref}
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      className={icon({ className, css })}
      {...props}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M9 5l7 7-7 7"
      />
    </svg>
  )
);

export const IconLightBulb = React.forwardRef<IIconRef, IIconProps>(
  ({ css, className, ...props }, ref) => (
    <svg
      ref={ref}
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      className={icon({ className, css })}
      {...props}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
      />
    </svg>
  )
);
