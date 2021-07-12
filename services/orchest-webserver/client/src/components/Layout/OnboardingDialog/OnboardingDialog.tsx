import * as React from "react";
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
  IconButton,
  IconCrossSolid,
  Text,
} from "@orchest/design-system";
import PipelineView from "@/views/PipelineView";
import { PipelineDiagram } from "./assets";
import {
  useOnboardingDialogCarousel,
  onboardingDialogCarouselSlides,
  OnboardingDialogCarousel,
  OnboardingDialogCarouselSlide,
  OnboardingDialogCarouselIndicator,
  ONBOARDING_DIALOG_CAROUSEL_MIN_HEIGHT,
} from "./OnboardingDialogCarousel";
import { useOnboardingDialog } from "./use-onboarding-dialog";

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

export const OnboardingDialog: React.FC = () => {
  const { orchest } = window;

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

  const onClose = ({ loadQuickstart }: { loadQuickstart?: boolean } = {}) => {
    setIsOnboardingDialogOpen(false, () => {
      setSlide([0, 0]);
      loadQuickstart &&
        orchest.loadView(PipelineView, {
          queryArgs: quickstart,
        });
    });
  };

  return (
    <Dialog
      open={isOnboardingDialogOpen}
      onOpenChange={(open) => (open ? onOpen() : onClose())}
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
                        [`> ${Text}`]: {
                          margin: "0 auto",
                          maxWidth: "$xs",
                        },
                        "> * + *": { marginTop: "$6" },
                      }}
                    >
                      {item.variant === "code" && (
                        <React.Fragment>
                          <Text>{item.description}</Text>
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
                        </React.Fragment>
                      )}

                      {item.variant === "icons" && (
                        <React.Fragment>
                          <Text>{item.description}</Text>
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
                        </React.Fragment>
                      )}

                      {item.variant === "pipeline-diagram" && (
                        <PipelineDiagram css={{ padding: "$2" }} />
                      )}

                      {item.variant === "end" && (
                        <React.Fragment>
                          <Text>
                            {hasQuickstart
                              ? item.description.withQuickstart
                              : item.description.withoutQuickstart}
                          </Text>
                        </React.Fragment>
                      )}
                    </DialogBody>
                  </Flex>
                </OnboardingDialogCarouselSlide>
              )
          )}
        </OnboardingDialogCarousel>
        <DialogFooter
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
    </Dialog>
  );
};
