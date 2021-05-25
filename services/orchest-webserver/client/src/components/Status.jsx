// @ts-check
import React from "react";
import {
  Text,
  IconCheckSolid,
  IconClockOutline,
  IconCrossSolid,
  IconDraftOutline,
} from "@orchest/design-system";

/**
 * @typedef {"DRAFT" | "PENDING" | "STARTED" | "SUCCESS" | "ABORTED" | "FAILURE" | ({} & string)} TStatus
 *
 * @param {Object} props
 * @param { TStatus } props.status
 * @param {import('@orchest/design-system').TTextVariants['size']} [props.size]
 */
export const Status = ({ status, size = "sm" }) => (
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
