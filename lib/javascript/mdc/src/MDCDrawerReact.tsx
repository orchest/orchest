import { MDCList } from "@material/list";
import { RefManager } from "@orchest/lib-utils";
import * as React from "react";

export class MDCDrawerReact extends React.Component<any> {
  refManager: RefManager;
  list: MDCList;

  constructor(props) {
    super(props);
    this.refManager = new RefManager();
  }

  componentDidMount() {
    this.list = new MDCList(this.refManager.refs.mainList);
    this.list.wrapFocus = true;
    this.list.singleSelection = true;

    this.handleSelectedIndex();

    this.list.listen("MDCList:action", (e) => {
      if (this.props.action) {
        // @ts-ignore
        this.list.selectedIndex = e.detail.index;
        this.props.action(
          e,
          this.props.items.filter((el) => {
            return typeof el != "string";
            // @ts-ignore
          })[this.list.selectedIndex]
        );
      }
    });
  }

  handleSelectedIndex() {
    if (this.props.selectedIndex !== undefined) {
      this.list.selectedIndex = this.props.selectedIndex;
    }
  }

  componentDidUpdate() {
    this.handleSelectedIndex();
  }

  render() {
    let elements = [];

    for (let x = 0; x < this.props.items.length; x++) {
      if (this.props.items[x] == "divider") {
        elements.push(
          <li
            key={x}
            role="separator"
            className="mdc-deprecated-list-divider"
          />
        );
      } else {
        elements.push(
          <a key={x} className="mdc-deprecated-list-item">
            <span className="mdc-deprecated-list-item__ripple" />
            {this.props.items[x].icon && (
              <i
                className="material-icons mdc-deprecated-list-item__graphic"
                aria-hidden="true"
              >
                {this.props.items[x].icon}
              </i>
            )}
            <span className="mdc-deprecated-list-item__text">
              {this.props.items[x].label}
            </span>
          </a>
        );
      }
    }

    return (
      <aside className="mdc-drawer">
        <div className="mdc-drawer__content">
          <nav
            className="mdc-deprecated-list"
            ref={this.refManager.nrefs.mainList}
          >
            {elements}
          </nav>
        </div>
      </aside>
    );
  }
}
