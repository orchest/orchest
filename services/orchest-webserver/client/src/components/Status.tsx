// @ts-check
import React from "react";
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
} from "@orchest/design-system";

/**
 * @typedef {"DRAFT" | "PENDING" | "STARTED" | "SUCCESS" | "ABORTED" | "FAILURE" | ({} & string)} TStatus
 */

const StatusInlineRoot = styled(Text, {
  include: "box",
  display: "inline-flex",
  alignItems: "center",
  "> *:first-child": { marginRight: "$2" },
});

/**
 * @param {Object} props
 * @param {TStatus} props.status
 * @param {string} [props.className],
 * @param {import('@orchest/design-system').ITextProps['size']} [props.size]
 * @param {import('@orchest/design-system').CSS} [props.css]
 */
export const StatusInline = ({ status, size = "sm", ...props }) => (
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

/**
 * @param {Object} props
 * @param {TStatus} props.status
 * @param {React.ReactNode} [props.icon]
 * @param {string} props.title
 * @param {string} [props.description]
 * @param {string} [props.className],
 * @param {import('@orchest/design-system').ITextProps['size']} [props.size]
 * @param {import('@orchest/design-system').CSS} [props.css]
 */
export const StatusGroup = ({ title, description, icon, status, ...props }) => (
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
