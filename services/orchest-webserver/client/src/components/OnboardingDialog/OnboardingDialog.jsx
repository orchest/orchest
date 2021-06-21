// @ts-check
import React from "react";
import { m, AnimatePresence } from "framer-motion";
import { MDCButtonReact } from "@orchest/lib-mdc";
import {
  css,
  Box,
  Flex,
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DIALOG_ANIMATION_DURATION,
  IconButton,
  IconCrossSolid,
  Text,
} from "@orchest/design-system";
import { useProjects } from "@/hooks/projects";
import { useLocalStorage } from "@/hooks/local-storage";
import PipelineView from "@/views/PipelineView";
import { PipelineDiagram } from "./assets";
import { slides, SLIDE_MIN_HEIGHT } from "./content";
import {
  useOnboardingCarouselState,
  OnboardingCarousel,
  OnboardingCarouselSlides,
  OnboardingCarouselSlide,
  OnboardingCarouselIndicator,
} from "./OnboardingCarousel";

const codeHeader = css({ include: "box", textAlign: "right" });
const codeHeading = css({
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
const codeWindow = css({
  include: "box",
  border: "2px $gray300 solid",
  borderRadius: "$md",
  borderTopRightRadius: 0,
  padding: "$1",
});
const codeList = css({
  include: "box",
  fontFamily: "monospace",
  textAlign: "left",
  backgroundColor: "$gray900",
  borderRadius: "$sm",
  margin: 0,
  padding: "$2",
  paddingLeft: "$7",
});
const codeListItem = css({
  include: "box",
  fontSize: "$sm",
  lineHeight: "$sm",
  color: "$white",
  "&::marker": {
    color: "$gray500",
    content: "'$ '",
  },
});

const iconList = css({
  include: "box",
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(0, 1fr))",
  gridAutoFlow: "column",
});
const iconListItem = css({
  include: "box",
  display: "flex",
  flexDirection: "column",
  fontSize: "$sm",
  "> i": { fontSize: "2rem", color: "$gray700", marginBottom: "$2" },
});

/** @param {import('@/hooks/projects/types').TUseProjectsOptions} [options] */
const useQuickstart = ({ shouldFetch }) => {
  const { data } = useProjects({ shouldFetch });

  const project = data?.find((project) => project.path === "quickstart");

  return typeof project === "undefined"
    ? undefined
    : {
        project_uuid: project.uuid,
        pipeline_uuid: "0915b350-b929-4cbd-b0d4-763cac0bb69f",
      };
};

/** @type React.FC<{}> */
export const OnboardingDialog = () => {
  const { orchest } = window;

  const [isDialogOpen, setIsDialogOpen] = React.useState(false);
  const [shouldFetch, setShouldFetch] = React.useState(false);
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useLocalStorage(
    "onboarding_completed",
    false
  );

  const {
    length,
    slideIndex,
    slideDirection,
    isLastSlide,
    cycleSlide,
    setSlide,
    isAnimating,
    setIsAnimating,
  } = useOnboardingCarouselState({
    length: slides.length,
  });

  const quickstart = useQuickstart({ shouldFetch });
  const hasQuickstart = typeof quickstart !== "undefined";

  const onOpen = () => {
    setIsDialogOpen(true);
    setShouldFetch(true);
  };
  /** @param {{loadQuickstart?: boolean}} [options] */
  const onClose = ({ loadQuickstart } = {}) => {
    setIsDialogOpen(false);
    setHasCompletedOnboarding(true);
    // Wait for Dialog transition to finish before resetting position.
    // This way we avoid showing the slides animating back to the start.
    setTimeout(() => {
      setShouldFetch(false);
      setSlide([0, 0]);
      loadQuickstart &&
        orchest.loadView(PipelineView, {
          queryArgs: quickstart,
        });
    }, DIALOG_ANIMATION_DURATION.OUT);
  };

  React.useEffect(() => {
    if (!hasCompletedOnboarding) onOpen();
  }, []);

  return (
    <Dialog
      open={isDialogOpen}
      onOpenChange={(open) => (open ? onOpen() : onClose())}
    >
      <OnboardingCarousel
        {...{
          length,
          slideIndex,
          slideDirection,
          isLastSlide,
          cycleSlide,
          setSlide,
          isAnimating,
          setIsAnimating,
        }}
      >
        <DialogContent
          size="md"
          css={{ paddingTop: "$10", overflow: isAnimating && "hidden" }}
        >
          <IconButton
            variant="ghost"
            rounded
            label="Close"
            onClick={() => onClose()}
            css={{ position: "absolute", top: "$4", right: "$4" }}
          >
            <IconCrossSolid />
          </IconButton>
          <OnboardingCarouselSlides>
            {slides.map(
              (item, i) =>
                i === slideIndex && (
                  <OnboardingCarouselSlide key={`OnboardingCarouselSlide-${i}`}>
                    <Flex
                      direction="column"
                      css={{
                        minHeight: SLIDE_MIN_HEIGHT,
                        justifyContent: "center",
                      }}
                    >
                      <DialogHeader css={{ justifyContent: "inherit" }}>
                        <DialogTitle
                          css={{ fontSize: "$2xl", lineHeight: "$2xl" }}
                        >
                          {item.title}
                        </DialogTitle>
                      </DialogHeader>
                      <DialogBody
                        css={{
                          width: "100%",
                          margin: "0 auto",
                          maxWidth: "$sm",
                          textAlign: "center",
                          "> * + *": { marginTop: "$6" },
                        }}
                      >
                        {item.description && (
                          <Text css={{ margin: "0 auto", maxWidth: "$xs" }}>
                            {item.description}
                          </Text>
                        )}

                        {item.variant === "code" && (
                          <article>
                            <header className={codeHeader()}>
                              <h1 className={codeHeading()}>
                                {item.code.title}
                              </h1>
                            </header>
                            <div className={codeWindow()}>
                              <ul role="list" className={codeList()}>
                                {item.code.lines.map((line, i) => (
                                  <li key={line} className={codeListItem()}>
                                    {line}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          </article>
                        )}

                        {item.variant === "icons" && (
                          <ul className={iconList()}>
                            {item.icons.map(({ icon, label }) => (
                              <li
                                key={[icon, label].join("-")}
                                className={iconListItem()}
                              >
                                <i
                                  aria-hidden={true}
                                  className="material-icons"
                                >
                                  {icon}
                                </i>
                                {label}
                              </li>
                            ))}
                          </ul>
                        )}

                        {item.variant === "pipeline-diagram" && (
                          <PipelineDiagram css={{ padding: "$2" }} />
                        )}
                      </DialogBody>
                    </Flex>
                  </OnboardingCarouselSlide>
                )
            )}
          </OnboardingCarouselSlides>
          <DialogFooter
            css={{
              flexDirection: "column",
              paddingTop: "$8",
              paddingBottom: "$8",
            }}
          >
            <OnboardingCarouselIndicator />

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
                          classNames: [
                            "mdc-button--raised",
                            "themed-secondary",
                          ],
                          onClick: () =>
                            onClose({ loadQuickstart: hasQuickstart }),
                        }
                      : {
                          label: "Next",
                          classNames: ["mdc-button--outlined"],
                          onClick: () => cycleSlide(1),
                        })}
                  />
                </m.div>
              </AnimatePresence>
            </Box>
          </DialogFooter>
        </DialogContent>
      </OnboardingCarousel>
    </Dialog>
  );
};
