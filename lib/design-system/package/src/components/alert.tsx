import * as React from "react";
import { useId } from "@radix-ui/react-id";
import { StitchesVariants } from "@stitches/react";
import { css } from "../core";
import { IconChevronLeft, IconChevronRight } from "../icons";
import { ICSSProp } from "../types";
import { IconButton } from "./icon-button";

const alert = css({
  $$gap: "$space$2",
  color: "$$textColor",
  padding: "$4",
  borderRadius: "$sm",
  textAlign: "left",
  "> * + *": {
    marginTop: "$$gap",
  },
  variants: {
    status: {
      info: {
        $$textColor: "$colors$black",
        $$paginationColor: "$colors$gray700",
        backgroundColor: "$gray50",
      },
      warning: {
        $$textColor: "$colors$yellow900",
        $$paginationColor: "$colors$yellow800",
        backgroundColor: "$colors$yellow50",
      },
    },
  },
});

const alertHeader = css({
  display: "flex",
  alignItems: "center",
  fontWeight: "$bold",
});

const alertIcon = css({
  display: "inline-flex",
  flexShrink: 0,
  alignSelf: "center",
  marginRight: "$$gap",
});

const alertTitle = css({ fontWeight: "$bold" });

const alertFooter = css({
  display: "flex",
  width: "100%",
  justifyContent: "space-between",
  marginTop: "$2",
});

const alertPagination = css({ color: "$$paginationColor" });

export interface IAlertRef extends HTMLDivElement {}

export interface IAlertProps extends ICSSProp, StitchesVariants<typeof alert> {
  title?: string;
  description?: React.ReactNode | React.ReactNode[];
  icon?: React.ReactNode;
}

export const Alert = React.forwardRef<IAlertRef, IAlertProps>(
  ({ css, status, title, description, icon, ...props }, ref) => {
    const titleId = useId();
    const descriptionId = useId();

    const [descriptionIndex, setDescriptionIndex] = React.useState(0);
    const cycleDescriptionIndex = (direction: "forwards" | "backwards") =>
      Array.isArray(description) &&
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
        aria-labelledby={title && titleId}
        aria-describedby={description && descriptionId}
        className={alert({ css, status })}
        {...props}
      >
        {title && (
          <p id={titleId} className={alertHeader()}>
            {icon && <span className={alertIcon()}>{icon}</span>}
            <span className={alertTitle()}>{title}</span>
          </p>
        )}

        {description && (
          <React.Fragment>
            <p id={descriptionId}>
              {!Array.isArray(description)
                ? description
                : description[descriptionIndex]}
            </p>

            {Array.isArray(description) && description.length > 1 && (
              <div className={alertFooter()}>
                <p className={alertPagination()}>
                  {descriptionIndex + 1}/{description.length}
                </p>
                <div role="group">
                  <IconButton
                    label="Back"
                    variant="ghost"
                    bleed="bottom"
                    onClick={() => cycleDescriptionIndex("forwards")}
                  >
                    <IconChevronLeft />
                  </IconButton>

                  <IconButton
                    label="Next"
                    variant="ghost"
                    bleed="bottomRight"
                    onClick={() => cycleDescriptionIndex("forwards")}
                  >
                    <IconChevronRight />
                  </IconButton>
                </div>
              </div>
            )}
          </React.Fragment>
        )}
      </div>
    );
  }
);
