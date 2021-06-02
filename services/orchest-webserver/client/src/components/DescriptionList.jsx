// @ts-check
import React from "react";
import { css, Grid } from "@orchest/design-system";

const descriptionPair = css({
  include: "box",
  display: "flex",
  flexDirection: "column",
});

const descriptionTerm = css({
  include: "box",
  gridRow: 1,
});

const descriptionDetails = css({
  fontSize: "$xl",
  lineHeight: "$xl",
});

/**
 * @typedef {React.ReactChild} TItemValue
 * @typedef {import('@orchest/design-system').TGridVariants} TGridVariants
 *
 * @param {Object} props
 *
 * @param {Record<"term" | "details", TItemValue>[]} props.items
 * @param {TGridVariants['columns']} [props.columns]
 * @param {TGridVariants['gap']} [props.gap]
 * @param {TGridVariants['columnGap']} [props.columnGap]
 * @param {TGridVariants['rowGap']} [props.rowGap]
 *
 * @param {import('@orchest/design-system').CSS} [props.css]
 * @param {string} [props.className]
 */
export const DescriptionList = ({ items, ...props }) => (
  <Grid as="dl" {...props}>
    {items.map((item, i) => (
      <div key={i} className={descriptionPair()}>
        <dt className={descriptionTerm()}>{item.term}</dt>
        <dd className={descriptionDetails()}>{item.details}</dd>
      </div>
    ))}
  </Grid>
);
