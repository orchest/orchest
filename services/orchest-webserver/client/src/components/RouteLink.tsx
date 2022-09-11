import Link, { LinkProps } from "@mui/material/Link";
import React from "react";
import {
  Link as RouterLink,
  LinkProps as RouterLinkProps,
} from "react-router-dom";

export type RouteLinkProps = Omit<LinkProps, "component" | "href"> &
  RouterLinkProps;

const RouteLink = (props: RouteLinkProps) => (
  <Link component={RouterLink} {...props} />
);

export default RouteLink;
