import { prettifyRoot } from "@/pipeline-view/file-manager/common";
import { basename, parents } from "@/utils/path";
import Breadcrumbs from "@mui/material/Breadcrumbs";
import Link from "@mui/material/Link";
import Typography from "@mui/material/Typography";
import React from "react";

export type PathBreadcrumbsProps = {
  path: string;
  root: string;
  onChange: (path: string) => void;
};

export const PathBreadcrumbs = ({
  root,
  path,
  onChange,
}: PathBreadcrumbsProps) => {
  return (
    <Breadcrumbs maxItems={3} itemsBeforeCollapse={0} itemsAfterCollapse={3}>
      <Link
        color="inherit"
        sx={{ cursor: "pointer" }}
        underline="hover"
        onClick={() => onChange("/")}
      >
        {prettifyRoot(root)}
      </Link>
      {path &&
        parents(path).map((parent) => (
          <Link
            sx={{ cursor: "pointer" }}
            underline="hover"
            color="inherit"
            key={path}
            onClick={() => onChange?.(parent)}
          >
            {basename(parent) || "/"}
          </Link>
        ))}
      <Typography color="text.primary">{basename(path)}</Typography>
    </Breadcrumbs>
  );
};
