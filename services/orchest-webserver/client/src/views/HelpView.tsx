import { Layout, useLayout } from "@/components/Layout";
import { useAppContext } from "@/contexts/AppContext";
import { useSendAnalyticEvent } from "@/hooks/useSendAnalyticEvent";
import { siteMap } from "@/routingConfig";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import React from "react";

const HelpItem: React.FC<{ link: string; image: string }> = ({
  link,
  children,
  image,
}) => {
  return (
    <Stack
      component="a"
      direction="row"
      alignItems="center"
      spacing={3}
      href={link}
      target="_blank"
      rel="noreferrer"
      sx={{ color: (theme) => theme.palette.text.primary }}
    >
      <Box
        sx={{
          width: (theme) => theme.spacing(3),
          height: (theme) => theme.spacing(3),
        }}
      >
        <img src={image} width="100%" />
      </Box>
      <Typography>{children}</Typography>
    </Stack>
  );
};

const HelpView: React.FC = () => {
  const {
    state: {
      config: {
        ORCHEST_WEB_URLS: { readthedocs, website, slack, github },
      },
    },
  } = useAppContext();

  useSendAnalyticEvent("view load", { name: siteMap.help.path });
  const { setIsOnboardingDialogOpen } = useLayout();

  return (
    <Layout>
      <div className="view-page help-list">
        <h2>Looking for help, or want to know more?</h2>
        <p className="push-down">
          The documentation should get you up to speed, but feel free to get in
          touch through Slack or GitHub for any questions or suggestions.
        </p>

        <Stack
          direction="column"
          spacing={3}
          sx={{ marginLeft: (theme) => theme.spacing(3) }}
        >
          <HelpItem
            link={`${readthedocs}/getting_started/quickstart.html`}
            image="/image/readthedocs.png"
          >
            Quickstart
          </HelpItem>
          <HelpItem link={readthedocs} image="/image/readthedocs.png">
            Documentation
          </HelpItem>
          <HelpItem
            link={`${website}/video-tutorials`}
            image="/image/favicon.png"
          >
            Video tutorials
          </HelpItem>
          <HelpItem link={slack} image="/image/slack.png">
            Slack
          </HelpItem>
          <HelpItem link={github} image="/image/github.png">
            GitHub
          </HelpItem>
          <HelpItem link={website} image="/image/favicon.png">
            Website
          </HelpItem>
        </Stack>

        <h2 className="push-up">Introduction</h2>
        <Button
          data-test-id="onboarding-open"
          onClick={() => setIsOnboardingDialogOpen(true)}
          startIcon={<PlayArrowIcon />}
        >
          Show onboarding
        </Button>
      </div>
    </Layout>
  );
};

export default HelpView;
