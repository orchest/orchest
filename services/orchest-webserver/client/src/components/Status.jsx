// @ts-check
import React from "react";
import {
  Text,
  Box,
  IconCheckSolid,
  IconClockOutline,
  IconCrossSolid,
  IconDraftOutline,
} from "@orchest/design-system";

/**
 * @typedef {"DRAFT" | "PENDING" | "STARTED" | "SUCCESS" | "ABORTED" | "FAILURE" | ({} & string)} TStatus
 */

/**
 * @param {Object} props
 * @param {TStatus} props.status
 * @param {import('@orchest/design-system').TTextVariants['size']} [props.size]
 */
export const InlineStatus = ({ status, size = "sm" }) => (
  <Text
    as="span"
    size={size}
    css={{
      display: "inline-flex",
      alignItems: "center",
      "> *:first-child": { marginRight: "$2" },
    }}
  >
    {
      {
        ABORTED: (
          <React.Fragment>
            <IconCrossSolid css={{ color: "$error" }} />
            Aborted
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
            Started…
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
      }[status || "PENDING"]
    }
  </Text>
);

/**
 * @param {Object} props
 * @param {TStatus} props.status
 * @param {React.ReactNode} [props.icon]
 * @param {string} props.title
 * @param {string} [props.description]
 * @param {import('@orchest/design-system').TTextVariants['size']} [props.size]
 */
export const GroupStatus = ({ title, description, icon, status }) => {
  const rows = description ? 2 : 1;

  return (
    <Box
      as="dl"
      css={{
        display: "grid",
        gridTemplateColumns: "$space$8 minmax(0, 1fr)",
        gridTemplateRows: `repeat(${rows}, minmax(0,1fr))`,
        alignItems: "center",
        columnGap: "$4",
      }}
    >
      <Box
        as="dt"
        css={{
          gridRow: `1 / ${rows + 1}`,
          justifySelf: "center",
        }}
      >
        {icon ||
          {
            ABORTED: <IconCrossSolid size="full" css={{ color: "$error" }} />,
            DRAFT: <IconDraftOutline size="full" css={{ color: "$gray500" }} />,
            STARTED: (
              <IconClockOutline size="full" css={{ color: "$warning" }} />
            ),
            PENDING: (
              <IconClockOutline size="full" css={{ color: "$warning" }} />
            ),
            FAILURE: <IconCrossSolid size="full" css={{ color: "$error" }} />,
            SUCCESS: <IconCheckSolid size="full" css={{ color: "$success" }} />,
          }[status]}
      </Box>
      <Text as="dt" css={{ fontSize: "$xl", lineHeight: "$base" }}>
        {title}
      </Text>
      {description && (
        <Text as="dd" css={{ color: "$textSecondary" }}>
          {description}
        </Text>
      )}
    </Box>
  );
};
