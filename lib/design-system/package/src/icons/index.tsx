import { StitchesVariants, InternalCSS } from "@stitches/core";
import * as React from "react";
import { css, config } from "../core";
import { ICSSProp } from "../types";

const getSizes = Object.keys(config.theme.space).reduce(
  (acc, cv) => ({ ...acc, [`${cv}`]: { $$iconSize: `$space$${cv}` } }),
  {}
) as { [key in keyof typeof config.theme.space]: InternalCSS };

export const icon = css({
  color: "currentcolor",
  width: "$$iconSize",
  height: "$$iconSize",
  verticalAlign: "middle",
  variants: {
    size: {
      ...getSizes,
      full: { $$iconSize: "100%" },
    },
  },
  defaultVariants: {
    size: 5,
  },
});

export type IIconRef = SVGSVGElement;
export interface IIconProps
  extends StitchesVariants<typeof icon>,
    ICSSProp,
    React.SVGProps<IIconRef> {}

export const IconCheckSolid = React.forwardRef<IIconRef, IIconProps>(
  ({ className, css, size, ...props }, ref) => (
    <svg
      ref={ref}
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 20 20"
      fill="currentColor"
      className={icon({ className, css, size })}
      {...props}
    >
      <path
        fillRule="evenodd"
        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
        clipRule="evenodd"
      />
    </svg>
  )
);

export const IconCheckCircleSolid = React.forwardRef<IIconRef, IIconProps>(
  ({ className, css, size, ...props }, ref) => (
    <svg
      ref={ref}
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 20 20"
      fill="currentColor"
      className={icon({ className, css, size })}
      {...props}
    >
      <path
        fillRule="evenodd"
        d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
        clipRule="evenodd"
      />
    </svg>
  )
);

export const IconClockOutline = React.forwardRef<IIconRef, IIconProps>(
  ({ className, css, size, ...props }, ref) => (
    <svg
      ref={ref}
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      className={icon({ className, css, size })}
      fill="none"
      stroke="currentColor"
      {...props}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </svg>
  )
);

export const IconClockSolid = React.forwardRef<IIconRef, IIconProps>(
  ({ className, css, size, ...props }, ref) => (
    <svg
      ref={ref}
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 20 20"
      fill="currentColor"
      className={icon({ className, css, size })}
      {...props}
    >
      <path
        fillRule="evenodd"
        d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z"
        clipRule="evenodd"
      />
    </svg>
  )
);

export const IconCrossSolid = React.forwardRef<IIconRef, IIconProps>(
  ({ className, css, size, ...props }, ref) => (
    <svg
      ref={ref}
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 20 20"
      fill="currentColor"
      className={icon({ className, css, size })}
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

export const IconCrossCircleSolid = React.forwardRef<IIconRef, IIconProps>(
  ({ className, css, size, ...props }, ref) => (
    <svg
      ref={ref}
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 20 20"
      fill="currentColor"
      className={icon({ className, css, size })}
      {...props}
    >
      <path
        fillRule="evenodd"
        d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
        clipRule="evenodd"
      />
    </svg>
  )
);

export const IconChevronLeftOutline = React.forwardRef<IIconRef, IIconProps>(
  ({ className, css, size, ...props }, ref) => (
    <svg
      ref={ref}
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      className={icon({ className, css, size })}
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

/** @deprecated replaced by IconChevronLeftOutline */
export const IconChevronLeft = IconChevronLeftOutline;

export const IconChevronRightOutline = React.forwardRef<IIconRef, IIconProps>(
  ({ className, css, size, ...props }, ref) => (
    <svg
      ref={ref}
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      className={icon({ className, css, size })}
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

/** @deprecated replaced by IconChevronRightOutline */
export const IconChevronRight = IconChevronRightOutline;

export const IconDraftOutline = React.forwardRef<IIconRef, IIconProps>(
  ({ css, className, size, ...props }, ref) => (
    <svg
      ref={ref}
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      className={icon({ className, css, size })}
      {...props}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
      />
    </svg>
  )
);

export const IconDraftCircleSolid = React.forwardRef<IIconRef, IIconProps>(
  ({ className, css, size, ...props }, ref) => (
    <svg
      ref={ref}
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 20 20"
      fill="currentColor"
      className={icon({ className, css, size })}
      {...props}
    >
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M15.6569 15.6569C14.1566 17.1571 12.1217 18 10 18c-2.12173 0-4.15656-.8429-5.65685-2.3431C2.84285 14.1566 2 12.1217 2 10c0-2.12173.84285-4.15656 2.34315-5.65685C5.84344 2.84285 7.87827 2 10 2c2.1217 0 4.1566.84285 5.6569 2.34315C17.1571 5.84344 18 7.87827 18 10c0 2.1217-.8429 4.1566-2.3431 5.6569zM13.707 6.29303c-.1875-.18747-.4418-.29279-.707-.29279-.2652 0-.5195.10532-.707.29279L8.5 10.086V11.5h1.414l3.793-3.79297c.1875-.18753.2928-.44184.2928-.707 0-.26516-.1053-.51947-.2928-.707zM6 8c0-.26522.10536-.51957.29289-.70711C6.48043 7.10536 6.73478 7 7 7h2c.13261 0 .25979.05268.35355.14645.09377.09376.14645.22094.14645.35355 0 .13261-.05268.25979-.14645.35355C9.25979 7.94732 9.13261 8 9 8H7v5h5v-2c0-.1326.0527-.2598.1464-.3536.0938-.0937.221-.1464.3536-.1464.1326 0 .2598.0527.3536.1464.0937.0938.1464.221.1464.3536v2c0 .2652-.1054.5196-.2929.7071S12.2652 14 12 14H7c-.26522 0-.51957-.1054-.70711-.2929C6.10536 13.5196 6 13.2652 6 13V8z"
      />
    </svg>
  )
);

export const IconLightBulbOutline = React.forwardRef<IIconRef, IIconProps>(
  ({ css, className, size, ...props }, ref) => (
    <svg
      ref={ref}
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      className={icon({ className, css, size })}
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

/** @deprecated replaced by IconLightBulbOutline */
export const IconLightBulb = IconLightBulbOutline;

export const IconWarningOutline = React.forwardRef<IIconRef, IIconProps>(
  ({ css, className, size, ...props }, ref) => (
    <svg
      ref={ref}
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      className={icon({ className, css, size })}
      {...props}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
      />
    </svg>
  )
);

/** @deprecated replaced by IconWarningOutline */
export const IconWarning = IconWarningOutline;
