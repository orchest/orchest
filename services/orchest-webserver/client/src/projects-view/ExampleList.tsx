import { Example } from "@/types";
import DownloadOutlinedIcon from "@mui/icons-material/DownloadOutlined";
import LaunchOutlinedIcon from "@mui/icons-material/LaunchOutlined";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Link from "@mui/material/Link";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemText from "@mui/material/ListItemText";
import Stack from "@mui/material/Stack";
import { styled } from "@mui/material/styles";
import Typography from "@mui/material/Typography";
import React from "react";
import GitHubButton from "react-github-btn";

const isCuratedByOrchest = (owner: string) =>
  ["orchest", "orchest-examples"].includes(owner.toLowerCase());

const GitHubStarButtonContainer = styled("div")(({ theme }) => ({
  transform: `translate(0, ${theme.spacing(0.5)})`,
}));

export const ExampleList = ({
  data,
  imporProject,
}: {
  data: Example[];
  imporProject: (url: string) => void;
}) => {
  return (
    <List sx={{ width: "100%", bgcolor: "background.paper" }}>
      {data.map((example, index) => {
        const { url, description, title, owner } = example;
        return (
          <ListItem
            alignItems="flex-start"
            key={url}
            divider={index < data.length - 1}
            sx={{ padding: (theme) => theme.spacing(2, 0) }}
          >
            <Stack
              direction={"row"}
              alignItems="flex-start"
              justifyContent="space-between"
              sx={{ width: "100%" }}
              spacing={2}
            >
              <ListItemText
                sx={{ margin: 0 }}
                primary={
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
                          textTransform: isCuratedByOrchest(owner)
                            ? "capitalize"
                            : "lowercase",
                        }}
                      >
                        {owner}
                      </Box>
                    </Typography>
                  </Stack>
                }
                secondary={description}
              />
              <Stack direction="row" alignItems="center" spacing={2}>
                <GitHubStarButtonContainer>
                  <GitHubButton
                    href={url}
                    data-icon="octicon-star"
                    data-size="large"
                    data-show-count="true"
                    aria-label={`Star "${title}" on GitHub`}
                  >
                    Star
                  </GitHubButton>
                </GitHubStarButtonContainer>
                <Button
                  variant="text"
                  size="small"
                  startIcon={<DownloadOutlinedIcon />}
                  onClick={() => imporProject(url)}
                  data-test-id="import-project"
                >
                  Import
                </Button>
              </Stack>
            </Stack>
          </ListItem>
        );
      })}
    </List>
  );
};
