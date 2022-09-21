import Link, { LinkProps } from "@mui/material/Link";
import React from "react";
import {
  Link as RouterLink,
  LinkProps as RouterLinkProps,
} from "react-router-dom";

type RouteLinkProps = Omit<LinkProps, "component" | "href"> & RouterLinkProps;

export const RouteLink = React.forwardRef<typeof Link, RouteLinkProps>(
  function RouteLink(props, ref) {
    return <Link component={RouterLink} {...props} ref={ref} />;
  }
);
