import React, { Fragment } from "react";

class HelpView extends React.Component {
  constructor(props) {
    super(props);

    this.state = {
      slack: orchest.config.HELP_MENU_CONTENT.slack,
      readthedocs: orchest.config.HELP_MENU_CONTENT.readthedocs,
      readthedocks_quickstart:
        orchest.config.HELP_MENU_CONTENT.readthedocks_quickstart,
      github: orchest.config.HELP_MENU_CONTENT.github,
      website: orchest.config.HELP_MENU_CONTENT.website,
    };
  }

  render() {
    return (
      <div className={"view-page"}>
        <h2>Looking for help, or want to know more?</h2>
        <p className="push-down">
          The documentation should get you up to speed, but feel free to get in
          touch through Slack or GitHub for any doubt or suggestion.
        </p>

        <li className="mdc-list">
          <a
            className="mdc-list-item"
            href={this.state.readthedocks_quickstart}
          >
            <i className="mdc-list-item__graphic" aria-hidden="true">
              <img src="public/image/readthedocs.png" width="100%" />
            </i>
            <span className="mdc-list-item__text">Quickstart</span>
          </a>
          <a className="mdc-list-item" href={this.state.readthedocs}>
            <i className="mdc-list-item__graphic" aria-hidden="true">
              <img src="public/image/readthedocs.png" width="100%" />
            </i>
            <span className="mdc-list-item__text">Documentation</span>
          </a>
          <a className="mdc-list-item" href={this.state.slack}>
            <i className="mdc-list-item__graphic" aria-hidden="true">
              <img src="public/image/slack.png" width="200%" />
            </i>
            <span className="mdc-list-item__text">Slack</span>
          </a>
          <a className="mdc-list-item" href={this.state.github}>
            {/* <i className="material-icons mdc-list-item__graphic" aria-hidden="true"
              >info</i
            > */}
            <i className="mdc-list-item__graphic" aria-hidden="true">
              <img src="public/image/github.png" width="100%" />
            </i>
            <span className="mdc-list-item__text">GitHub</span>
          </a>
          <a className="mdc-list-item" href={this.state.website}>
            <i className="mdc-list-item__graphic" aria-hidden="true">
              <img src="public/image/favicon.png" width="150%" />
            </i>
            <span className="mdc-list-item__text">{this.state.website}</span>
          </a>
        </li>
      </div>
    );
  }
}

export default HelpView;
