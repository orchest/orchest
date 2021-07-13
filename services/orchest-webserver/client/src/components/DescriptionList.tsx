import * as React from "react";
import { css, Grid, ICSSProp, TGridVariants } from "@orchest/design-system";

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

const DEFAULT_ELEMENT = "dl";

export type TDescriptionListRef = HTMLDListElement;
export interface IDescriptionListProps
  extends React.HTMLAttributes<TDescriptionListRef>,
    TGridVariants,
    ICSSProp {
  items: Record<"term" | "details", React.ReactChild>[];
}

export const DescriptionList: React.FC<IDescriptionListProps> = ({
  items,
  ...props
}) => (
  <Grid as={DEFAULT_ELEMENT} {...props}>
    {items.map((item, i) => (
      <div key={i} className={descriptionPair()}>
        <dt className={descriptionTerm()}>{item.term}</dt>
        <dd className={descriptionDetails()}>{item.details}</dd>
      </div>
    ))}
  </Grid>
);
