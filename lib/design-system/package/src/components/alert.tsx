import * as React from "react";
import { useId } from "@radix-ui/react-id";
import { styled } from "../core";
import { IconChevronLeftOutline, IconChevronRightOutline } from "../icons";
import type { ExtractVariants, ICSSProp } from "../types";
import { IconButton } from "./icon-button";
import { Text } from "./text";

const AlertRoot = styled("div", {
  $$alertGap: "$space$2",
  padding: "$4",
  borderRadius: "$sm",
  textAlign: "left",
  "> * + *": {
    marginTop: "$$alertGap",
  },
  variants: {
    status: {
      info: {
        $$paginationColor: "$colors$alertTextSecondaryInfo",
        color: "$colors$alertTextInfo",
        backgroundColor: "$alertBackgroundInfo",
      },
      warning: {
        $$paginationColor: "$colors$alertTextSecondaryWarning",
        color: "$colors$alertTextWarning",
        backgroundColor: "$alertBackgroundWarning",
      },
    },
  },
  defaultVariants: {
    status: "info",
  },
});

const AlertHeader = styled("p", {
  display: "flex",
  alignItems: "center",
  fontWeight: "$bold",
});

const AlertIcon = styled("span", {
  display: "inline-flex",
  flexShrink: 0,
  alignSelf: "center",
  marginRight: "$$alertGap",
});

const AlertTitle = styled(Text, { fontWeight: "$bold" });

const AlertFooter = styled("div", {
  display: "flex",
  width: "100%",
  justifyContent: "space-between",
  marginTop: "$2",
});

const AlertPagination = styled(Text, { color: "$$paginationColor" });

export interface IAlertRef extends HTMLDivElement {}

export type TAlertVariants = ExtractVariants<typeof AlertRoot>;
export interface IAlertProps extends ICSSProp, TAlertVariants {
  title?: string;
  description?: React.ReactNode | React.ReactNode[];
  icon?: React.ReactNode;
}

export const Alert = React.forwardRef<IAlertRef, IAlertProps>(
  ({ title, description, icon, ...props }, ref) => {
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
      <AlertRoot
        ref={ref}
        role="alert"
        aria-live="polite"
        aria-labelledby={title && titleId}
        aria-describedby={description && descriptionId}
        {...props}
      >
        {title && (
          <AlertHeader as="p" id={titleId}>
            {icon && <AlertIcon>{icon}</AlertIcon>}
            <AlertTitle as="span">{title}</AlertTitle>
          </AlertHeader>
        )}

        {description && (
          <React.Fragment>
            <Text id={descriptionId}>
              {!Array.isArray(description)
                ? description
                : description[descriptionIndex]}
            </Text>

            {Array.isArray(description) && description.length > 1 && (
              <AlertFooter>
                <AlertPagination as="p">
                  {descriptionIndex + 1}/{description.length}
                </AlertPagination>
                <div role="group">
                  <IconButton
                    label="Back"
                    color="multiply"
                    variant="ghost"
                    bleed="bottom"
                    onClick={() => cycleDescriptionIndex("backwards")}
                  >
                    <IconChevronLeftOutline />
                  </IconButton>

                  <IconButton
                    label="Next"
                    color="multiply"
                    variant="ghost"
                    bleed="bottomRight"
                    onClick={() => cycleDescriptionIndex("forwards")}
                  >
                    <IconChevronRightOutline />
                  </IconButton>
                </div>
              </AlertFooter>
            )}
          </React.Fragment>
        )}
      </AlertRoot>
    );
  }
);
