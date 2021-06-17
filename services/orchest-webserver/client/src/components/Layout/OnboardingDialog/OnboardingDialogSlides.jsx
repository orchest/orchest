// @ts-check
import React from "react";
import { css, Flex, Text } from "@orchest/design-system";
import { PipelineDiagram } from "./PipelineDiagram";
import { MDCButtonReact } from "@orchest/lib-mdc";

const iconList = css({
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(0, 1fr))",
  gridAutoFlow: "column",
});

const iconListItem = css({
  display: "flex",
  flexDirection: "column",
  fontSize: "$sm",
  "> i": { fontSize: "2rem", color: "$gray700", marginBottom: "$2" },
});

/**
 * @typedef {{title: string, body: React.ReactNode}} TOnboardingDialogSlide
 * @type {TOnboardingDialogSlide[]}
 */
export const onboardingDialogSlides = [
  {
    title: "Discover Orchest",
    body: (
      <Flex gap="6" direction="column">
        <Text>Find out more about the core concepts.</Text>
        <ul className={iconList()}>
          {[
            <>
              <i aria-hidden={true} className="material-icons">
                device_hub
              </i>
              Pipelines
            </>,
            <>
              <i aria-hidden={true} className="material-icons">
                pending_actions
              </i>
              Jobs
            </>,
            <>
              <i aria-hidden={true} className="material-icons">
                view_comfy
              </i>
              Environments
            </>,
          ].map((item, i) => (
            <li key={`concepts-${i}`} className={iconListItem()}>
              {item}
            </li>
          ))}
        </ul>
      </Flex>
    ),
  },
  { title: "Pipelines", body: <PipelineDiagram css={{ padding: "0 $4" }} /> },
  {
    title: "Jobs",
    body: (
      <Flex gap="6" direction="column">
        <Text>Flexibly run data pipelines.</Text>
        <ul className={iconList()}>
          {[
            <>
              <i aria-hidden={true} className="material-icons">
                pending_actions
              </i>
              Scheduled runs
            </>,
            <>
              <i aria-hidden={true} className="material-icons">
                history
              </i>
              Track history
            </>,
            <>
              <i aria-hidden={true} className="material-icons">
                tune
              </i>
              Parameterized
            </>,
          ].map((item, i) => (
            <li key={`concepts-${i}`} className={iconListItem()}>
              {item}
            </li>
          ))}
        </ul>
      </Flex>
    ),
  },
  {
    title: "Environments",
    body: (
      <React.Fragment>
        <Text>The power of container images, without the hassle.</Text>
      </React.Fragment>
    ),
  },
  {
    title: "Get Started",
    body: (
      <Flex gap="6" direction="column">
        <Text>
          Check out the Quickstart pipeline to see it all in action 🚀
        </Text>
      </Flex>
    ),
  },
];
