import { Grid, ICSSProp, styled, TGridVariants } from "@orchest/design-system";
import * as React from "react";

const DescriptionPair = styled("div", {
  include: "box",
  display: "flex",
  flexDirection: "column",
});

const DescriptionTerm = styled("dt", {
  include: "box",
  gridRow: 1,
});

const DescriptionDetails = styled("dd", {
  fontSize: "$xl",
  lineHeight: "$xl",
});

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
  <Grid as="dl" {...props}>
    {items.map((item, i) => (
      <DescriptionPair key={i}>
        <DescriptionTerm>{item.term}</DescriptionTerm>
        <DescriptionDetails>{item.details}</DescriptionDetails>
      </DescriptionPair>
    ))}
  </Grid>
);
