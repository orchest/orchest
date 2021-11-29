import { Layout, useLayout } from "@/components/Layout";
import { useAppContext } from "@/contexts/AppContext";
import { useSendAnalyticEvent } from "@/hooks/useSendAnalyticEvent";
import { siteMap } from "@/routingConfig";
import { MDCButtonReact } from "@orchest/lib-mdc";
import React from "react";

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

        <div className="mdc-list">
          <a
            className="mdc-deprecated-list-item"
            href={readthedocs + "/getting_started/quickstart.html"}
            target="_blank"
            rel="noreferrer"
          >
            <i className="mdc-deprecated-list-item__graphic" aria-hidden="true">
              <img src="/image/readthedocs.png" width="100%" />
            </i>
            <span className="mdc-deprecated-list-item__text">Quickstart</span>
          </a>
          <a
            className="mdc-deprecated-list-item"
            href={readthedocs}
            target="_blank"
            rel="noreferrer"
          >
            <i className="mdc-deprecated-list-item__graphic" aria-hidden="true">
              <img src="/image/readthedocs.png" width="100%" />
            </i>
            <span className="mdc-deprecated-list-item__text">
              Documentation
            </span>
          </a>
          <a
            className="mdc-deprecated-list-item"
            href={website + "/video-tutorials"}
            target="_blank"
            rel="noreferrer"
          >
            <i className="mdc-deprecated-list-item__graphic" aria-hidden="true">
              <img src="/image/favicon.png" width="100%" />
            </i>
            <span className="mdc-deprecated-list-item__text">
              Video tutorials
            </span>
          </a>
          <a
            className="mdc-deprecated-list-item"
            href={slack}
            target="_blank"
            rel="noreferrer"
          >
            <i className="mdc-deprecated-list-item__graphic" aria-hidden="true">
              <img src="/image/slack.png" width="100%" />
            </i>
            <span className="mdc-deprecated-list-item__text">Slack</span>
          </a>
          <a
            className="mdc-deprecated-list-item"
            href={github}
            target="_blank"
            rel="noreferrer"
          >
            <i className="mdc-deprecated-list-item__graphic" aria-hidden="true">
              <img src="/image/github.png" width="100%" />
            </i>
            <span className="mdc-deprecated-list-item__text">GitHub</span>
          </a>
          <a
            className="mdc-deprecated-list-item"
            href={website}
            target="_blank"
            rel="noreferrer"
          >
            <i className="mdc-deprecated-list-item__graphic" aria-hidden="true">
              <img src="/image/favicon.png" width="100%" />
            </i>
            <span className="mdc-deprecated-list-item__text">Website</span>
          </a>
        </div>
        <h2 className="push-up">Introduction</h2>
        <MDCButtonReact
          data-test-id="onboarding-open"
          onClick={() => {
            setIsOnboardingDialogOpen(true);
          }}
          label="Show onboarding"
          icon="play_arrow"
        />
      </div>
    </Layout>
  );
};

export default HelpView;
