import { IconButton } from "@/components/common/IconButton";
import { useNavigate } from "@/hooks/useCustomRoute";
import StyledButtonOutlined from "@/styled-components/StyledButton";
import CloseIcon from "@mui/icons-material/Close";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import Box from "@mui/material/Box";
import Dialog from "@mui/material/Dialog";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Stack from "@mui/material/Stack";
import { styled } from "@mui/material/styles";
import Typography from "@mui/material/Typography";
import { hasValue } from "@orchest/lib-utils";
import { AnimatePresence, m } from "framer-motion";
import React from "react";
import { PipelineDiagram } from "./assets";
import {
  OnboardingDialogCarousel,
  OnboardingDialogCarouselIndicator,
  OnboardingDialogCarouselSlide,
  onboardingDialogCarouselSlides,
  ONBOARDING_DIALOG_CAROUSEL_MIN_HEIGHT,
  useOnboardingDialogCarousel,
} from "./OnboardingDialogCarousel";
import { useOnboardingDialog } from "./use-onboarding-dialog";

const CodeHeader = styled(Box)({ textAlign: "right" });

const CodeWindow = styled(Box)(({ theme }) => ({
  border: `2px ${theme.palette.grey[300]} solid`,
  borderRadius: theme.shape.borderRadius,
  borderTopRightRadius: 0,
  padding: theme.spacing(1),
}));
const CodeList = styled("ul")(({ theme }) => ({
  fontFamily: "monospace",
  textAlign: "left",
  backgroundColor: theme.palette.grey[900],
  borderRadius: theme.shape.borderRadius,
  margin: 0,
  padding: theme.spacing(2),
  paddingLeft: theme.spacing(4),
}));
const CodeListItem = styled("li")(({ theme }) => ({
  fontSize: theme.typography.fontSize,
  lineHeight: "$sm",
  color: theme.palette.common.white,
  "&::marker": {
    color: theme.palette.grey[500],
    content: "'$ '",
  },
}));

const IconList = styled("ul")(({ theme }) => ({
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(0, 1fr))",
  gridAutoFlow: "column",
  marginTop: theme.spacing(3),
}));
const IconListItem = styled("li")(({ theme }) => ({
  display: "flex",
  flexDirection: "column",
  fontSize: theme.typography.fontSize * 0.8,
  "> i": {
    fontSize: "2rem",
    color: theme.palette.grey[700],
    marginBottom: theme.spacing(1),
  },
}));

const CloseButton = ({ onClose }: { onClose: () => void }) => (
  <IconButton
    title="Close"
    onClick={onClose}
    size="small"
    sx={{
      position: "absolute",
      top: (theme) => theme.spacing(2),
      right: (theme) => theme.spacing(2),
    }}
    data-test-id="onboarding-close"
  >
    <CloseIcon />
  </IconButton>
);

export const OnboardingDialog: React.FC = () => {
  const navigate = useNavigate();

  const {
    isOnboardingDialogOpen,
    setIsOnboardingDialogOpen,
    quickstart,
    hasImportUrl,
  } = useOnboardingDialog();

  const {
    length,
    slideIndex,
    slideDirection,
    setIsAnimating,
    isLastSlide,
    cycleSlide,
    setSlide,
  } = useOnboardingDialogCarousel();

  const onCompleteOnboarding = () => {
    setIsOnboardingDialogOpen(false, () => {
      setSlide({ index: 0, direction: 0 });
      if (!hasImportUrl) {
        if (hasValue(quickstart)) {
          navigate({
            route: "pipeline",
            query: {
              projectUuid: quickstart.project_uuid,
              pipelineUuid: quickstart.pipeline_uuid,
            },
          });
          return;
        }
        navigate({ route: "home", sticky: false, query: { tab: "projects" } });
      }
    });
  };

  const onDismiss = () => {
    setIsOnboardingDialogOpen(false, () => {
      setSlide({ index: 0, direction: 0 });
    });
  };

  return (
    <Dialog
      open={isOnboardingDialogOpen}
      onClose={onDismiss}
      fullWidth
      maxWidth="xs"
    >
      <CloseButton onClose={onDismiss} />
      <DialogContent
        sx={{ paddingTop: (theme) => theme.spacing(4), overflow: "hidden" }}
        data-test-id="onboarding-dialog-content"
      >
        <OnboardingDialogCarousel slideDirection={slideDirection}>
          {onboardingDialogCarouselSlides.map(
            (item, i) =>
              i === slideIndex && (
                <OnboardingDialogCarouselSlide
                  slideDirection={slideDirection}
                  slideIndex={slideIndex}
                  setIsAnimating={setIsAnimating}
                  length={length}
                  key={`OnboardingDialogCarouselSlide-${i}`}
                >
                  <Stack
                    direction="column"
                    sx={{
                      minHeight: ONBOARDING_DIALOG_CAROUSEL_MIN_HEIGHT,
                      justifyContent: "center",
                    }}
                  >
                    <DialogTitle
                      sx={{
                        fontSize: "typography.h2",
                        lineHeight: 2,
                        textAlign: "center",
                      }}
                      data-test-id="onboarding-title"
                    >
                      {item.title}
                    </DialogTitle>
                    <Box
                      sx={{
                        width: "100%",
                        margin: "0 auto",
                        maxWidth: "24rem",
                        textAlign: "center",
                      }}
                    >
                      {item.variant === "icons" && (
                        <>
                          <Typography>{item.description}</Typography>
                          <IconList>
                            {item.icons.map(({ icon, label }) => (
                              <IconListItem key={[icon, label].join("-")}>
                                <i
                                  aria-hidden={true}
                                  className="material-icons"
                                >
                                  {icon}
                                </i>
                                {label}
                              </IconListItem>
                            ))}
                          </IconList>
                        </>
                      )}
                      {item.variant === "code" && (
                        <>
                          <Typography
                            sx={{ maxWidth: "20rem", margin: "0 auto 1.5rem" }}
                          >
                            {item.description}
                          </Typography>
                          <article>
                            <CodeHeader>
                              <Typography
                                variant="caption"
                                sx={{
                                  display: "inline-block",
                                  padding: (theme) =>
                                    `${theme.spacing(0.5)} ${theme.spacing(
                                      1.5
                                    )}`,
                                  marginBottom: "-2px",
                                  borderTopLeftRadius: (theme) =>
                                    theme.shape.borderRadius,
                                  borderTopRightRadius: (theme) =>
                                    theme.shape.borderRadius,
                                  backgroundColor: (theme) =>
                                    theme.palette.primary.main,
                                  color: (theme) => theme.palette.common.white,
                                }}
                              >
                                {item.code.title}
                              </Typography>
                            </CodeHeader>
                            <CodeWindow>
                              <CodeList role="list">
                                {item.code.lines.map((line) => (
                                  <CodeListItem key={line}>{line}</CodeListItem>
                                ))}
                              </CodeList>
                            </CodeWindow>
                          </article>
                        </>
                      )}

                      {item.variant === "pipeline-diagram" && (
                        <PipelineDiagram css={{ padding: "$2" }} />
                      )}

                      {item.variant === "end" && (
                        <Typography>
                          {hasImportUrl
                            ? item.description.importProject
                            : hasValue(quickstart)
                            ? item.description.withQuickstart
                            : item.description.withoutQuickstart}
                        </Typography>
                      )}
                    </Box>
                  </Stack>
                </OnboardingDialogCarouselSlide>
              )
          )}
        </OnboardingDialogCarousel>
      </DialogContent>
      <Stack direction="column">
        <OnboardingDialogCarouselIndicator
          length={length}
          setSlide={setSlide}
          slideIndex={slideIndex}
        />
        <Box
          sx={{
            marginTop: (theme) => theme.spacing(4),
            marginBottom: (theme) => theme.spacing(4),
            width: "100%",
            textAlign: "center",
          }}
        >
          <AnimatePresence initial={false}>
            <m.div
              key={isLastSlide ? "onboarding-end" : "onboarding-next"}
              initial={{ y: 50, opacity: 0, height: 0 }}
              animate={{ y: 0, opacity: 1, zIndex: 1, height: "auto" }}
              exit={{ y: 0, opacity: 0, zIndex: 0, height: 0 }}
              transition={{ type: "spring", damping: 15, stiffness: 150 }}
            >
              <StyledButtonOutlined
                {...(isLastSlide
                  ? {
                      startIcon: (hasImportUrl || hasValue(quickstart)) && (
                        <OpenInNewIcon />
                      ),
                      children: hasImportUrl
                        ? "Import Project"
                        : hasValue(quickstart)
                        ? "Open Quickstart Pipeline"
                        : "Get Started",
                      variant: "contained",
                      color: "primary",
                      onClick: onCompleteOnboarding,
                      "data-test-id": hasValue(quickstart)
                        ? "onboarding-complete-with-quickstart"
                        : "onboarding-complete-without-quickstart",
                    }
                  : {
                      children: "Next",
                      color: "secondary",
                      variant: "outlined",
                      sx: {
                        borderColor: (theme) => theme.palette.grey[400],
                        "&:hover": {
                          borderColor: (theme) => theme.palette.grey[400],
                        },
                      },
                      onClick: () => cycleSlide(1),
                      "data-test-id": "onboarding-next",
                    })}
              />
            </m.div>
          </AnimatePresence>
        </Box>
      </Stack>
    </Dialog>
  );
};
