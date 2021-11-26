import { useCustomRoute } from "@/hooks/useCustomRoute";
import { siteMap } from "@/Routes";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import {
  Box,
  Flex,
  IconButton,
  IconCrossSolid,
  styled,
  Text,
} from "@orchest/design-system";
import { MDCButtonReact } from "@orchest/lib-mdc";
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

const CodeHeader = styled("header", { include: "box", textAlign: "right" });
const CodeHeading = styled("h1", {
  include: "box",
  display: "inline-block",
  padding: "$1 $2",
  marginBottom: "-2px",
  fontSize: "$xs",
  borderTopLeftRadius: "$sm",
  borderTopRightRadius: "$sm",
  backgroundColor: "$primary",
  color: "$white",
});
const CodeWindow = styled("div", {
  include: "box",
  border: "2px $gray300 solid",
  borderRadius: "$md",
  borderTopRightRadius: 0,
  padding: "$1",
});
const CodeList = styled("ul", {
  include: "box",
  fontFamily: "monospace",
  textAlign: "left",
  backgroundColor: "$gray900",
  borderRadius: "$sm",
  margin: 0,
  padding: "$2",
  paddingLeft: "$7",
});
const CodeListItem = styled("li", {
  include: "box",
  fontSize: "$sm",
  lineHeight: "$sm",
  color: "$white",
  "&::marker": {
    color: "$gray500",
    content: "'$ '",
  },
});

const IconList = styled("ul", {
  include: "box",
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(0, 1fr))",
  gridAutoFlow: "column",
});
const IconListItem = styled("li", {
  include: "box",
  display: "flex",
  flexDirection: "column",
  fontSize: "$sm",
  "> i": { fontSize: "2rem", color: "$gray700", marginBottom: "$2" },
});

export const OnboardingDialog: React.FC = () => {
  const { navigateTo } = useCustomRoute();

  const {
    isOnboardingDialogOpen,
    setIsOnboardingDialogOpen,
    quickstart,
    hasQuickstart,
  } = useOnboardingDialog();

  const {
    slideIndex,
    isLastSlide,
    cycleSlide,
    setSlide,
    isAnimating,
  } = useOnboardingDialogCarousel();

  const onOpen = () => setIsOnboardingDialogOpen(true);

  const onClose = (loadQuickstart = false) => {
    setIsOnboardingDialogOpen(false, () => {
      setSlide([0, 0]);
      if (loadQuickstart) {
        navigateTo(siteMap.pipeline.path, {
          query: {
            projectUuid: quickstart.project_uuid,
            pipelineUuid: quickstart.pipeline_uuid,
          },
        });
      }
    });
  };

  return (
    <Dialog open={isOnboardingDialogOpen} onClose={onClose}>
      <DialogContent
        css={{ paddingTop: "$10", overflow: isAnimating && "hidden" }}
        data-test-id="onboarding-dialog-content"
      >
        <IconButton
          variant="ghost"
          rounded
          title="Close"
          onClick={() => onClose()}
          css={{ position: "absolute", top: "$4", right: "$4" }}
          data-test-id="onboarding-close"
        >
          <IconCrossSolid />
        </IconButton>
        <OnboardingDialogCarousel>
          {onboardingDialogCarouselSlides.map(
            (item, i) =>
              i === slideIndex && (
                <OnboardingDialogCarouselSlide
                  key={`OnboardingDialogCarouselSlide-${i}`}
                >
                  <Flex
                    direction="column"
                    css={{
                      minHeight: ONBOARDING_DIALOG_CAROUSEL_MIN_HEIGHT,
                      justifyContent: "center",
                    }}
                  >
                    <DialogTitle
                      css={{ fontSize: "$2xl", lineHeight: "$2xl" }}
                      data-test-id="onboarding-title"
                    >
                      {item.title}
                    </DialogTitle>
                    <Box
                      css={{
                        width: "100%",
                        margin: "0 auto",
                        maxWidth: "$sm",
                        textAlign: "center",
                        [`> ${Text}`]: {
                          margin: "0 auto",
                          maxWidth: "$xs",
                        },
                        "> * + *": { marginTop: "$6" },
                      }}
                    >
                      {item.variant === "code" && (
                        <>
                          <Text>{item.description}</Text>
                          <article>
                            <CodeHeader>
                              <CodeHeading>{item.code.title}</CodeHeading>
                            </CodeHeader>
                            <CodeWindow>
                              <CodeList role="list">
                                {item.code.lines.map((line, i) => (
                                  <CodeListItem key={line}>{line}</CodeListItem>
                                ))}
                              </CodeList>
                            </CodeWindow>
                          </article>
                        </>
                      )}

                      {item.variant === "icons" && (
                        <React.Fragment>
                          <Text>{item.description}</Text>
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
                        </React.Fragment>
                      )}

                      {item.variant === "pipeline-diagram" && (
                        <PipelineDiagram css={{ padding: "$2" }} />
                      )}

                      {item.variant === "end" && (
                        <Text>
                          {hasQuickstart
                            ? item.description.withQuickstart
                            : item.description.withoutQuickstart}
                        </Text>
                      )}
                    </Box>
                  </Flex>
                </OnboardingDialogCarouselSlide>
              )
          )}
        </OnboardingDialogCarousel>
        <DialogActions
          css={{
            flexDirection: "column",
            paddingTop: "$8",
            paddingBottom: "$8",
          }}
        >
          <OnboardingDialogCarouselIndicator />

          <Box css={{ marginTop: "$6", width: "100%", textAlign: "center" }}>
            <AnimatePresence initial={false}>
              <m.div
                key={isLastSlide ? "onboarding-end" : "onboarding-next"}
                initial={{ y: 50, opacity: 0, height: 0 }}
                animate={{ y: 0, opacity: 1, zIndex: 1, height: "auto" }}
                exit={{ y: 0, opacity: 0, zIndex: 0, height: 0 }}
                transition={{ type: "spring", damping: 15, stiffness: 150 }}
              >
                <MDCButtonReact
                  {...(isLastSlide
                    ? {
                        icon: hasQuickstart && "open_in_new",
                        label: hasQuickstart
                          ? "Open Quickstart Pipeline"
                          : "Get Started",
                        classNames: ["mdc-button--raised", "themed-secondary"],
                        onClick: () => onClose(hasQuickstart),
                        "data-test-id": hasQuickstart
                          ? "onboarding-complete-with-quickstart"
                          : "onboarding-complete-without-quickstart",
                      }
                    : {
                        label: "Next",
                        classNames: ["mdc-button--outlined"],
                        onClick: () => cycleSlide(1),
                        "data-test-id": "onboarding-next",
                      })}
                />
              </m.div>
            </AnimatePresence>
          </Box>
        </DialogActions>
      </DialogContent>
    </Dialog>
  );
};
