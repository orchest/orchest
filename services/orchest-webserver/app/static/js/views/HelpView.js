import React, { Fragment } from "react";

class HelpView extends React.Component {
  constructor(props) {
    super(props);

    this.state = {
      readthedocs_quickstart_url:
        orchest.config.ORCHEST_WEB_URLS.readthedocs +
        "/getting_started/quickstart.html",
      readthedocs_url: orchest.config.ORCHEST_WEB_URLS.readthedocs,
      slack_url: orchest.config.ORCHEST_WEB_URLS.slack,
      github_url: orchest.config.ORCHEST_WEB_URLS.github,
      website_url: orchest.config.ORCHEST_WEB_URLS.website,
    };
  }

  render() {
    return (
      <div className={"view-page"}>
        <h2>Looking for help, or want to know more?</h2>
        <p className="push-down">
          The documentation should get you up to speed, but feel free to get in
          touch through Slack or GitHub for any questions or suggestions.
        </p>

        <li className="mdc-list">
          <a
            className="mdc-list-item"
            href={this.state.readthedocs_quickstart_url}
          >
            <i className="mdc-list-item__graphic" aria-hidden="true">
              <img src="public/image/readthedocs.png" width="100%" />
            </i>
            <span className="mdc-list-item__text">Quickstart</span>
          </a>
          <a className="mdc-list-item" href={this.state.readthedocs_url}>
            <i className="mdc-list-item__graphic" aria-hidden="true">
              <img src="public/image/readthedocs.png" width="100%" />
            </i>
            <span className="mdc-list-item__text">Documentation</span>
          </a>
          <a className="mdc-list-item" href={this.state.slack_url}>
            <i className="mdc-list-item__graphic" aria-hidden="true">
              <img src="public/image/slack.png" width="100%" />
            </i>
            <span className="mdc-list-item__text">Slack</span>
          </a>
          <a className="mdc-list-item" href={this.state.github_url}>
            {/* <i className="material-icons mdc-list-item__graphic" aria-hidden="true"
              >info</i
            > */}
            <i className="mdc-list-item__graphic" aria-hidden="true">
              <img src="public/image/github.png" width="100%" />
            </i>
            <span className="mdc-list-item__text">GitHub</span>
          </a>
          <a className="mdc-list-item" href={this.state.website_url}>
            <i className="mdc-list-item__graphic" aria-hidden="true">
              <img src="public/image/favicon.png" width="100%" />
            </i>
            <span className="mdc-list-item__text">Website</span>
          </a>
        </li>
      </div>
    );
  }
}

export default HelpView;
