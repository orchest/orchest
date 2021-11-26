import { useId } from "@radix-ui/react-id";
import * as React from "react";
import { styled } from "../core";
import {
  Icon,
  IconChevronLeftOutline,
  IconChevronRightOutline,
} from "../icons";
import type { ExtractVariants, ICSSProp } from "../types";
import { IconButton } from "./icon-button";
import { Text, TTextVariants } from "./text";

/* eslint-disable react/display-name */

interface IAlertContext {
  descriptionIndex: number;
  setDescriptionIndex: React.Dispatch<
    React.SetStateAction<IAlertContext["descriptionIndex"]>
  >;
  descriptionLength: number;
  setDescriptionLength: React.Dispatch<
    React.SetStateAction<IAlertContext["descriptionLength"]>
  >;
  cycleDescriptionIndex: (direction: "forwards" | "backwards") => void;
  getTitleProps: () => { id: string };
  getDescriptionProps: () => { id: string };
}

const AlertContext = React.createContext<IAlertContext>({} as IAlertContext);
const useAlertContext = () => React.useContext(AlertContext);

/* Alert (Root)
  =========================================== */

const StyledAlert = styled("div", {
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

export type IAlertRef = HTMLDivElement;
export type TAlertVariants = ExtractVariants<typeof StyledAlert>;
export interface IAlertProps extends ICSSProp, TAlertVariants {
  children?: React.ReactNode;
}

export const Alert = React.forwardRef<IAlertRef, IAlertProps>((props, ref) => {
  const titleId = useId();
  const descriptionId = useId();

  const [descriptionIndex, setDescriptionIndex] = React.useState(0);
  const [descriptionLength, setDescriptionLength] = React.useState(1);

  const cycleDescriptionIndex = (direction: "forwards" | "backwards") =>
    descriptionLength > 1 &&
    setDescriptionIndex(
      (prevIndex) =>
        ({
          forwards: prevIndex + 1,
          backwards: prevIndex <= 0 ? descriptionLength - 1 : prevIndex - 1,
        }[direction] % descriptionLength)
    );

  const getDescriptionProps = () => ({
    id: descriptionId,
  });
  const getTitleProps = () => ({
    id: titleId,
  });

  return (
    <AlertContext.Provider
      value={{
        descriptionIndex,
        setDescriptionIndex,
        descriptionLength,
        setDescriptionLength,
        cycleDescriptionIndex,
        getDescriptionProps,
        getTitleProps,
      }}
    >
      <StyledAlert
        ref={ref}
        role="alert"
        aria-live="polite"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        {...props}
      />
    </AlertContext.Provider>
  );
});

/* AlertHeader
  =========================================== */

const StyledAlertHeader = styled("p", {
  display: "flex",
  alignItems: "center",
  fontWeight: "$bold",
  [`> ${Icon}, > svg:not([class])`]: {
    display: "inline-flex",
    flexShrink: 0,
    alignSelf: "center",
    marginRight: "$$alertGap",
  },
});

export type IAlertHeaderRef = HTMLParagraphElement;
export type TAlertHeaderVariants = ExtractVariants<typeof StyledAlertHeader>;
export interface IAlertHeaderProps extends ICSSProp, TAlertHeaderVariants {
  children?: React.ReactNode;
}

export const AlertHeader = React.forwardRef<IAlertHeaderRef, IAlertHeaderProps>(
  (props, ref) => {
    const { getTitleProps } = useAlertContext();
    return <StyledAlertHeader ref={ref} {...getTitleProps()} {...props} />;
  }
);

/* AlertDescription
  =========================================== */

export type IAlertDescriptionRef = HTMLParagraphElement;
export type TAlertDescriptionVariants = TTextVariants;
export interface IAlertDescriptionProps
  extends ICSSProp,
    TAlertDescriptionVariants {
  children?: React.ReactNode;
}

export const AlertDescription = React.forwardRef<
  IAlertDescriptionRef,
  IAlertDescriptionProps
>(({ children, ...props }, ref) => {
  const {
    descriptionIndex,
    getDescriptionProps,
    setDescriptionLength,
  } = useAlertContext();

  React.useEffect(() => {
    if (Array.isArray(children)) setDescriptionLength(children.length);
  }, []);

  return (
    <Text ref={ref} as="p" {...getDescriptionProps()} {...props}>
      {Array.isArray(children) ? children[descriptionIndex] : children}
    </Text>
  );
});

/* AlertControls
  =========================================== */

const StyledControls = styled("div", {
  display: "flex",
  width: "100%",
  justifyContent: "space-between",
  marginTop: "$2",
  variants: {
    hasMultipleDescriptions: {
      true: {
        display: "none",
      },
    },
  },
});

const StyledPagination = styled(Text, { color: "$$paginationColor" });

export type IAlertControlsRef = HTMLDivElement;

export type IAlertControlsProps = ICSSProp;

export const AlertControls = React.forwardRef<
  IAlertControlsRef,
  IAlertControlsProps
>((props, ref) => {
  const {
    descriptionIndex,
    descriptionLength,
    cycleDescriptionIndex,
  } = useAlertContext();

  return (
    <StyledControls
      ref={ref}
      hasMultipleDescriptions={descriptionLength <= 1}
      {...props}
    >
      <StyledPagination>
        {descriptionIndex + 1}/{descriptionLength}
      </StyledPagination>
      <div role="group">
        <IconButton
          title="Back"
          color="multiply"
          variant="ghost"
          bleed="bottom"
          onClick={() => cycleDescriptionIndex("backwards")}
        >
          <IconChevronLeftOutline />
        </IconButton>

        <IconButton
          title="Next"
          color="multiply"
          variant="ghost"
          bleed="bottomRight"
          onClick={() => cycleDescriptionIndex("forwards")}
        >
          <IconChevronRightOutline />
        </IconButton>
      </div>
    </StyledControls>
  );
});

/* eslint-enable react/display-name */
