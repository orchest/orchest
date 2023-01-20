import Link, { LinkProps } from "@mui/material/Link";
import React from "react";
import {
  Link as RouterLink,
  LinkProps as RouterLinkProps,
} from "react-router-dom";

export type RouteLinkProps = Omit<LinkProps, "component"> & RouterLinkProps;

export const RouteLink = React.forwardRef<typeof Link, RouteLinkProps>(
  function RouteLink({ to, href, ...props }, ref) {
    return <Link component={RouterLink} to={to ?? href} {...props} ref={ref} />;
  }
);
