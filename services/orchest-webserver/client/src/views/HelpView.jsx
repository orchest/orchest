// @ts-check
import React from "react";
import { useOrchest } from "@/hooks/orchest";
import { Layout } from "@/components/Layout";
import { MDCButtonReact } from "../../../../../lib/javascript/mdc/src";
import { useLocalStorage } from "@/hooks/local-storage";
import ProjectsView from "./ProjectsView";

const HelpView = () => {
  const { state } = useOrchest();

  const orchest = window.orchest;

  const [, setHasCompletedOnboarding] = useLocalStorage(
    "onboarding_completed",
    false
  );

  return (
    <Layout>
      <div className="view-page help-list">
        <h2>Looking for help, or want to know more?</h2>
        <p className="push-down">
          The documentation should get you up to speed, but feel free to get in
          touch through Slack or GitHub for any questions or suggestions.
        </p>

        <div className="mdc-list">
          <a
            className="mdc-list-item"
            href={
              state.config.ORCHEST_WEB_URLS.readthedocs +
              "/getting_started/quickstart.html"
            }
            target="_blank"
          >
            <i className="mdc-list-item__graphic" aria-hidden="true">
              <img src="/image/readthedocs.png" width="100%" />
            </i>
            <span className="mdc-list-item__text">Quickstart</span>
          </a>
          <a
            className="mdc-list-item"
            href={state.config.ORCHEST_WEB_URLS.readthedocs}
            target="_blank"
          >
            <i className="mdc-list-item__graphic" aria-hidden="true">
              <img src="/image/readthedocs.png" width="100%" />
            </i>
            <span className="mdc-list-item__text">Documentation</span>
          </a>
          <a
            className="mdc-list-item"
            href={state.config.ORCHEST_WEB_URLS.website + "/knowledge-base"}
            target="_blank"
          >
            <i className="mdc-list-item__graphic" aria-hidden="true">
              <img src="/image/favicon.png" width="100%" />
            </i>
            <span className="mdc-list-item__text">Knowledge base videos</span>
          </a>
          <a
            className="mdc-list-item"
            href={state.config.ORCHEST_WEB_URLS.slack}
            target="_blank"
          >
            <i className="mdc-list-item__graphic" aria-hidden="true">
              <img src="/image/slack.png" width="100%" />
            </i>
            <span className="mdc-list-item__text">Slack</span>
          </a>
          <a
            className="mdc-list-item"
            href={state.config.ORCHEST_WEB_URLS.github}
            target="_blank"
          >
            <i className="mdc-list-item__graphic" aria-hidden="true">
              <img src="/image/github.png" width="100%" />
            </i>
            <span className="mdc-list-item__text">GitHub</span>
          </a>
          <a
            className="mdc-list-item"
            href={state.config.ORCHEST_WEB_URLS.website}
            target="_blank"
          >
            <i className="mdc-list-item__graphic" aria-hidden="true">
              <img src="/image/favicon.png" width="100%" />
            </i>
            <span className="mdc-list-item__text">Website</span>
          </a>
        </div>
        <h2 className="push-up">Introduction</h2>
        <MDCButtonReact
          onClick={() => {
            setHasCompletedOnboarding(false);
            orchest.loadView(ProjectsView);
          }}
          label="Show onboarding"
          icon="play_arrow"
        />
      </div>
    </Layout>
  );
};

export default HelpView;
