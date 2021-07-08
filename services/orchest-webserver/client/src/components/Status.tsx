import * as React from "react";
import {
  Text,
  IconCheckSolid,
  IconClockOutline,
  IconCrossSolid,
  IconDraftCircleOutline,
  IconCheckCircleOutline,
  IconCrossCircleOutline,
  styled,
  IconDraftOutline,
  ICSSProp,
  ITextProps,
} from "@orchest/design-system";

export type TStatus =
  | "DRAFT"
  | "PENDING"
  | "STARTED"
  | "SUCCESS"
  | "ABORTED"
  | "FAILURE"
  | ({} & string);

const StatusInlineRoot = styled(Text, {
  include: "box",
  display: "inline-flex",
  alignItems: "center",
  "> *:first-child": { marginRight: "$2" },
});

export interface IStatusInlineProps extends ICSSProp {
  status: TStatus;
  className?: string;
  size?: ITextProps["size"];
}

export const StatusInline: React.FC<IStatusInlineProps> = ({
  status,
  size = "sm",
  ...props
}) => (
  <StatusInlineRoot as="span" size={size} {...props}>
    {
      {
        ABORTED: (
          <React.Fragment>
            <IconCrossSolid css={{ color: "$error" }} />
            Cancelled
          </React.Fragment>
        ),
        DRAFT: (
          <React.Fragment>
            <IconDraftOutline css={{ color: "$gray500" }} />
            Draft
          </React.Fragment>
        ),
        STARTED: (
          <React.Fragment>
            <IconClockOutline css={{ color: "$warning" }} />
            Running…
          </React.Fragment>
        ),
        PENDING: (
          <React.Fragment>
            <IconClockOutline css={{ color: "$warning" }} />
            Pending…
          </React.Fragment>
        ),
        FAILURE: (
          <React.Fragment>
            <IconCrossSolid css={{ color: "$error" }} />
            Failed
          </React.Fragment>
        ),
        SUCCESS: (
          <React.Fragment>
            <IconCheckSolid css={{ color: "$success" }} />
            Success
          </React.Fragment>
        ),
      }[status]
    }
  </StatusInlineRoot>
);

const StatusGroupIcon = styled("dt", {
  justifySelf: "center",
  "> svg": {
    verticalAlign: "initial",
  },
});
const StatusGroupRoot = styled("dl", {
  include: "box",
  display: "grid",
  gridTemplateColumns: "$space$6 minmax(0, 1fr)",
  alignItems: "start",
  columnGap: "$2",
  [`${StatusGroupIcon}`]: { gridRow: "$$iconPosition" },
  variants: {
    rows: {
      1: {
        $$iconPosition: "span 1",
      },
      2: {
        $$iconPosition: "span 2",
      },
    },
  },
});
const StatusGroupTitle = styled(Text, { fontSize: "$xl" });
const StatusGroupDescription = styled(Text, {
  color: "$textSecondary",
});

export interface IStatusGroupProps
  extends React.HTMLAttributes<HTMLDListElement>,
    ICSSProp {
  status: TStatus;
  icon?: React.ReactNode;
  title: string;
  description?: string;
  size?: ITextProps["size"];
}

export const StatusGroup: React.FC<IStatusGroupProps> = ({
  title,
  description,
  icon,
  status,
  ...props
}) => (
  <StatusGroupRoot rows={description ? 2 : 1} {...props}>
    <StatusGroupIcon>
      {icon ||
        {
          ABORTED: <IconCrossSolid size="full" css={{ color: "$error" }} />,
          DRAFT: (
            <IconDraftCircleOutline size="full" css={{ color: "$gray500" }} />
          ),
          STARTED: <IconClockOutline size="full" css={{ color: "$warning" }} />,
          PENDING: <IconClockOutline size="full" css={{ color: "$warning" }} />,
          FAILURE: (
            <IconCrossCircleOutline size="full" css={{ color: "$error" }} />
          ),
          SUCCESS: (
            <IconCheckCircleOutline size="full" css={{ color: "$success" }} />
          ),
        }[status]}
    </StatusGroupIcon>
    <StatusGroupTitle as="dt">{title}</StatusGroupTitle>
    {description && (
      <StatusGroupDescription as="dd">{description}</StatusGroupDescription>
    )}
  </StatusGroupRoot>
);
