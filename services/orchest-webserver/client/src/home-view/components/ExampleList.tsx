import { useExamplesApi } from "@/api/examples/useExamplesApi";
import { Example } from "@/types";
import { paginate } from "@/utils/array";
import CheckIcon from "@mui/icons-material/Check";
import DownloadOutlinedIcon from "@mui/icons-material/DownloadOutlined";
import LaunchOutlinedIcon from "@mui/icons-material/LaunchOutlined";
import StarOutlineIcon from "@mui/icons-material/StarOutline";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Link from "@mui/material/Link";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import Pagination from "@mui/material/Pagination";
import Skeleton from "@mui/material/Skeleton";
import Stack from "@mui/material/Stack";
import { alpha, SxProps, Theme } from "@mui/material/styles";
import Typography from "@mui/material/Typography";
import { hasValue } from "@orchest/lib-utils";
import React from "react";
import { ImportProjectDialog } from "./ImportProjectDialog";

const isCuratedByOrchest = (owner: string) =>
  ["orchest", "orchest-examples"].includes(owner.toLowerCase());

const withOrchest = (sx: SxProps<Theme>): SxProps<Theme> => ({
  backgroundColor: (theme) => alpha(theme.palette.success.light, 0.2),
  " .MuiChip-icon": {
    color: (theme) => theme.palette.success.main,
  },
  ...sx,
});

const exampleChipCommonStyle: SxProps<Theme> = {
  margin: (theme) => theme.spacing(0, 1, 1, 0),
};

const ExampleTag = ({
  label,
  isOwnedByOrchest,
}: {
  label: string;
  isOwnedByOrchest?: boolean;
}) => {
  return (
    <Chip
      size="small"
      icon={isOwnedByOrchest ? <CheckIcon /> : undefined}
      label={label}
      sx={
        isOwnedByOrchest
          ? withOrchest(exampleChipCommonStyle)
          : exampleChipCommonStyle
      }
    />
  );
};

const ENTRIES_PER_PAGE = 5;

export const ExampleList = () => {
  const examples = useExamplesApi((api) => api.examples);
  const [importing, setImporting] = React.useState<Example>();
  const hasData = hasValue(examples);

  const [page, setPageNumber] = React.useState(1);
  const { items, pageCount } = React.useMemo(() => {
    return paginate(examples ?? [], page, ENTRIES_PER_PAGE);
  }, [examples, page]);

  return (
    <Stack gap={2} alignItems="center" justifyContent="flex-start">
      <List sx={{ padding: 0, minHeight: 625, width: "100%" }}>
        {items.map((example, index) => {
          const isOwnedByOrchest = isCuratedByOrchest(example.owner);

          return (
            <ListItem
              alignItems="flex-start"
              key={example.url}
              divider={index < items.length - 1}
              sx={{ padding: (theme) => theme.spacing(2, 0, 1) }}
            >
              <Stack
                direction="row"
                alignItems="flex-start"
                justifyContent="space-between"
                sx={{ width: "100%" }}
                spacing={2}
              >
                <Stack direction="column" spacing={1}>
                  <Stack direction={"row"} alignItems="baseline">
                    <Link
                      underline="hover"
                      sx={{
                        cursor: "pointer",
                        display: "flex",
                        flexDirection: "row",
                        alignItems: "center",
                        color: (theme) => theme.palette.common.black,
                        ":hover, :hover svg": {
                          color: (theme) => theme.palette.primary.main,
                        },
                      }}
                      target="_blank"
                      rel="noopener noreferrer"
                      href={example.url}
                      variant="body1"
                    >
                      <Box component="span">{example.title}</Box>
                      <LaunchOutlinedIcon
                        sx={{
                          marginLeft: (theme) => theme.spacing(0.5),
                          fontSize: (theme) => theme.typography.body1.fontSize,
                          color: (theme) => theme.palette.action.active,
                        }}
                      />
                    </Link>
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      sx={{ marginLeft: (theme) => theme.spacing(1.5) }}
                    >
                      {"by "}
                      <Box
                        component="span"
                        sx={{
                          textTransform: isOwnedByOrchest
                            ? "capitalize"
                            : "lowercase",
                        }}
                      >
                        {example.owner}
                      </Box>
                    </Typography>
                  </Stack>
                  <Typography variant="body2" color="text.secondary">
                    {example.description}
                  </Typography>
                  <Stack direction="row" flexWrap="wrap">
                    {isOwnedByOrchest && (
                      <ExampleTag label="Verified" isOwnedByOrchest />
                    )}
                    {example.tags.map((tag) => (
                      <ExampleTag key={tag} label={tag} />
                    ))}
                  </Stack>
                </Stack>
                <Stack direction="row" alignItems="center" spacing={2}>
                  <Link
                    underline="hover"
                    sx={{
                      cursor: "pointer",
                      display: "flex",
                      flexDirection: "row",
                      alignItems: "center",
                      color: (theme) => theme.palette.common.black,
                      ":hover, :hover svg": {
                        color: (theme) => theme.palette.primary.main,
                      },
                    }}
                    target="_blank"
                    rel="noopener noreferrer"
                    href={example.url}
                    variant="body1"
                  >
                    <StarOutlineIcon
                      sx={{
                        margin: (theme) => theme.spacing(0, 0.5),
                        fontSize: (theme) => theme.typography.body1.fontSize,
                        color: (theme) => theme.palette.action.active,
                      }}
                    />
                    <Typography component="span" variant="body2">
                      {example.stargazers_count}
                    </Typography>
                  </Link>
                  <Button
                    variant="text"
                    size="small"
                    startIcon={<DownloadOutlinedIcon />}
                    onClick={() => setImporting(example)}
                    data-test-id="import-project"
                    sx={{ marginLeft: (theme) => theme.spacing(2) }}
                  >
                    Import
                  </Button>
                </Stack>
              </Stack>
            </ListItem>
          );
        })}
        {!hasData &&
          Array(5)
            .fill(null)
            .map((_, index) => (
              <ListItem key={index} divider={index < 4}>
                <Stack marginLeft={-2} width="100%" height={92}>
                  <Skeleton width={120 + Math.random() * 100} height={36} />
                </Stack>
              </ListItem>
            ))}
      </List>

      {importing && (
        <ImportProjectDialog
          open={true}
          importUrl={importing.url}
          onClose={() => setImporting(undefined)}
        />
      )}

      <Pagination
        color="primary"
        count={pageCount}
        page={page}
        onChange={(_, pageNumber) => setPageNumber(pageNumber)}
      />
    </Stack>
  );
};
