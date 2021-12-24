import StyledButtonOutlined from "@/styled-components/StyledButton";
import { Example } from "@/types";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import Card from "@mui/material/Card";
import CardActions from "@mui/material/CardActions";
import CardContent from "@mui/material/CardContent";
import Chip from "@mui/material/Chip";
import Stack from "@mui/material/Stack";
import { styled } from "@mui/material/styles";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import React from "react";
import GitHubButton from "react-github-btn";

type ExampleCardProps = Example & {
  startImport: (url: string) => void;
};

const MAX_TAG_NUMBER = 3;

const OpenNewLink = styled("a")(({ theme }) => ({
  marginLeft: theme.spacing(2),
  marginBottom: theme.spacing(-1),
  color: theme.palette.grey[800],
  display: "flex",
  textDecoration: "none",
}));

const ExtraTag = styled("span")(({ theme }) => ({
  width: theme.spacing(3),
  height: theme.spacing(3),
  color: theme.palette.grey[700],
  fontSize: theme.typography.caption.fontSize,
  backgroundColor: theme.palette.common.white,
  border: `1px solid ${theme.palette.grey[400]}`,
  borderRadius: "100%",
  padding: theme.spacing(0.5),
  display: "flex",
  alignItems: "center",
}));

const GitHubStarButtonContainer = styled("div")(({ theme }) => ({
  transform: `translate(0, ${theme.spacing(0.5)})`,
}));

const ExampleCard: React.FC<ExampleCardProps> = ({
  title,
  description,
  tags,
  owner,
  url,
  startImport,
}) => {
  const importExample = () => startImport(url);
  const isOwnedByOrchest = ["orchest", "orchest-examples"].includes(owner);

  const restNumber = Math.max(tags.length - MAX_TAG_NUMBER, 0);
  const shownTags = restNumber > 0 ? tags.slice(0, MAX_TAG_NUMBER) : tags;
  const extraTags = restNumber > 0 ? tags.slice(MAX_TAG_NUMBER) : [];

  return (
    <Card
      sx={{
        width: "28rem",
        height: "20rem",
        display: "flex",
        flexDirection: "column",
        padding: (theme) => theme.spacing(2),
        marginTop: (theme) => theme.spacing(4),
        marginRight: (theme) => theme.spacing(4),
      }}
    >
      <CardContent
        sx={{
          display: "flex",
          flexDirection: "column",
          flex: 1,
        }}
      >
        <Stack direction="row" alignItems="center">
          {shownTags.map((tag) => (
            <Tooltip key={tag} title={tag.toUpperCase()}>
              <Chip
                label={tag}
                className="truncate"
                size="small"
                sx={{
                  textTransform: "uppercase",
                  fontSize: (theme) => theme.typography.caption.fontSize,
                  maxWidth: (theme) => theme.spacing(16),
                  minWidth: (theme) => theme.spacing(10),
                  marginRight: (theme) => theme.spacing(2),
                }}
              />
            </Tooltip>
          ))}
          {restNumber > 0 && (
            <Tooltip
              title={extraTags.map((extraTag) => (
                <Typography variant="caption" key={extraTag}>
                  {extraTag.toUpperCase()}
                </Typography>
              ))}
            >
              <ExtraTag>{`+${restNumber}`}</ExtraTag>
            </Tooltip>
          )}
        </Stack>
        <Stack direction="row" alignItems="center">
          <Tooltip title={title}>
            <Typography
              variant="h6"
              component="h3"
              className="truncate"
              sx={{
                maxWidth: (theme) => `calc(100% - ${theme.spacing(4)})`,
                margin: (theme) => theme.spacing(3, 0, 2),
              }}
            >
              {title}
            </Typography>
          </Tooltip>
          <Tooltip title="open in new tab">
            <OpenNewLink
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              title="open in new tab"
            >
              <OpenInNewIcon />
            </OpenNewLink>
          </Tooltip>
        </Stack>
        <Typography
          variant="subtitle2"
          sx={{
            color: (theme) => theme.palette.grey[500],
            marginBottom: (theme) => theme.spacing(2),
          }}
        >
          by
          <Typography
            component="span"
            sx={{ paddingLeft: (theme) => theme.spacing(0.5) }}
            className={isOwnedByOrchest ? "capitalized" : ""}
          >
            {owner}
          </Typography>
        </Typography>
        <Typography
          variant="body1"
          sx={{
            color: (theme) => theme.palette.grey[700],
            overflowY: "hidden",
            flex: 1,
          }}
        >
          {description}
        </Typography>
      </CardContent>
      <CardActions
        className="example-card-button-container"
        style={{
          // justifyContent: isOwnedByOrchest ? "flex-end" : "space-between",
          justifyContent: "space-between",
        }}
      >
        {/* {!isOwnedByOrchest && ( */}
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
        {/* )} */}
        <StyledButtonOutlined
          variant="outlined"
          color="secondary"
          onClick={importExample}
        >
          IMPORT
        </StyledButtonOutlined>
      </CardActions>
    </Card>
  );
};

export { ExampleCard };
