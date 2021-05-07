import * as React from "react";
import { StitchesVariants } from "@stitches/react";
import { css } from "../core";
import { ICSSProp } from "../types";
import { Link } from "./link";

const alert = css({
  padding: "$4",
  borderRadius: "$sm",
  textAlign: "left",
  variants: {
    status: {
      info: {
        backgroundColor: "$gray50",
      },
    },
  },
});

const alertHeader = css({
  display: "inline-flex",
  alignItems: "center",
  fontWeight: "$bold",
});

const alertIcon = css({
  "> svg": {
    width: "$fontSizes$base",
    height: "auto",
    color: "$text",
    verticalAlign: "unset",
    marginRight: "$2",
  },
});

const alertTitle = css({ fontWeight: "$bold" });

const alertBody = css({ marginTop: "$1" });

const alertFooter = css({
  display: "flex",
  width: "100%",
  justifyContent: "space-between",
  marginTop: "$2",
});

const alertPagination = css({ color: "$gray700" });

export interface IAlertRef extends HTMLDivElement {}

export interface IAlertProps extends ICSSProp, StitchesVariants<typeof alert> {
  title?: string;
  description?: string | string[];
  icon?: React.ReactNode;
}

export const Alert = React.forwardRef<IAlertRef, IAlertProps>(
  ({ css, status, title, description, icon, ...props }, ref) => {
    const isOnlyDescription = !Array.isArray(description);
    const [descriptionIndex, setDescriptionIndex] = React.useState(0);
    const cycleDescriptionIndex = (direction: "forwards" | "backwards") =>
      setDescriptionIndex(
        (prevIndex) =>
          ({
            forwards: prevIndex + 1,
            backwards: prevIndex <= 0 ? description.length - 1 : prevIndex - 1,
          }[direction] % description.length)
      );

    return (
      <div
        ref={ref}
        role="alert"
        aria-live="polite"
        className={alert({ css, status })}
        {...props}
      >
        {title && (
          <p className={alertHeader()}>
            {icon && <span className={alertIcon()}>{icon}</span>}
            <span className={alertTitle()}>{title}</span>
          </p>
        )}

        {description && (
          <React.Fragment>
            <p className={alertBody()}>
              {isOnlyDescription ? description : description[descriptionIndex]}
            </p>
            {console.log("farts")}
            {!isOnlyDescription && description.length > 1 && (
              <div className={alertFooter()}>
                <p className={alertPagination()}>
                  {descriptionIndex + 1}/{description.length}
                </p>
                <div role="group">
                  <Link
                    as="button"
                    variant="inline"
                    onClick={() => cycleDescriptionIndex("backwards")}
                  >
                    Back
                  </Link>

                  <Link
                    as="button"
                    variant="inline"
                    onClick={() => cycleDescriptionIndex("forwards")}
                  >
                    Next
                  </Link>
                </div>
              </div>
            )}
          </React.Fragment>
        )}
      </div>
    );
  }
);
