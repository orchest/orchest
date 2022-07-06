import { Example } from "@/types";
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
import Stack from "@mui/material/Stack";
import { alpha, SxProps, Theme } from "@mui/material/styles";
import Typography from "@mui/material/Typography";
import React from "react";

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

const ENTRIES_PER_PAGE = 10;

export const ExampleList = ({
  data = [],
  imporProject,
}: {
  data: Example[] | undefined;
  imporProject: (url: string) => void;
}) => {
  const [page, setPage] = React.useState(1);
  const renderedExamples = React.useMemo(() => {
    const range = [page - 1, page].map((i) => i * ENTRIES_PER_PAGE);
    return data.slice(...range);
  }, [data, page]);

  const totalPageCount = React.useMemo(() => {
    return Math.ceil(data.length / ENTRIES_PER_PAGE);
  }, [data]);
  const goToPage = (event: React.ChangeEvent<unknown>, value: number) => {
    setPage(value);
  };
  return (
    <>
      <List sx={{ width: "100%", bgcolor: "background.paper" }}>
        {renderedExamples.map((example, index) => {
          const {
            url,
            description,
            title,
            owner,
            tags,
            stargazers_count,
          } = example;
          const isOwnedByOrchest = isCuratedByOrchest(owner);
          return (
            <ListItem
              alignItems="flex-start"
              key={url}
              divider={index < data.length - 1}
              sx={{ padding: (theme) => theme.spacing(2, 0, 1) }}
            >
              <Stack
                direction={"row"}
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
                      href={url}
                      variant="body1"
                    >
                      <Box component="span">{title}</Box>
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
                        {owner}
                      </Box>
                    </Typography>
                  </Stack>
                  <Typography variant="body2" color="text.secondary">
                    {description}
                  </Typography>
                  <Stack direction="row" flexWrap="wrap">
                    {isOwnedByOrchest && (
                      <ExampleTag label="Verified" isOwnedByOrchest />
                    )}
                    {tags.map((tag) => {
                      return <ExampleTag key={tag} label={tag} />;
                    })}
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
                    href={url}
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
                      {stargazers_count}
                    </Typography>
                  </Link>
                  <Button
                    variant="text"
                    size="small"
                    startIcon={<DownloadOutlinedIcon />}
                    onClick={() => imporProject(url)}
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
      </List>
      <Stack
        justifyContent="center"
        alignItems="center"
        sx={{ width: "100%", padding: (theme) => theme.spacing(2, 0) }}
      >
        <Pagination
          color="primary"
          count={totalPageCount}
          page={page}
          onChange={goToPage}
        />
      </Stack>
    </>
  );
};
