import * as React from "react";

/* eslint-disable react/display-name */

type SVGProps = React.SVGProps<SVGSVGElement>;

export const IconCrossSolid = React.forwardRef<SVGSVGElement, SVGProps>(
  (props, ref) => (
    <svg
      style={{ width: 25, height: 25 }}
      ref={ref}
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 20 20"
      fill="currentColor"
      {...props}
    >
      <path
        fillRule="evenodd"
        d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
        clipRule="evenodd"
      />
    </svg>
  )
);

export const IconChevronLeftOutline = React.forwardRef<SVGSVGElement, SVGProps>(
  (props, ref) => (
    <svg
      style={{ width: 25, height: 25 }}
      ref={ref}
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
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

export const IconChevronRightOutline = React.forwardRef<
  SVGSVGElement,
  SVGProps
>((props, ref) => (
  <svg
    style={{ width: 25, height: 25 }}
    ref={ref}
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
    {...props}
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M9 5l7 7-7 7"
    />
  </svg>
));

/* eslint-enable react/display-name */
