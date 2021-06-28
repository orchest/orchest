// @ts-check
import React from "react";
import { MDCDrawer } from "@material/drawer";
import { useOrchest } from "@/hooks/orchest";
import {
  getViewDrawerParentViewName,
  nameToComponent,
} from "../utils/webserver-utils";

/**
 * @type React.FC<{selectedElement: string}>
 */
const MainDrawer = (props) => {
  const context = useOrchest();

  const drawerRef = React.useRef(null);
  const [drawer, setDrawer] = React.useState(null);
  const drawerIsMounted = drawerRef && drawer != null;

  const { orchest } = window;

  const setDrawerSelectedElement = (viewName) => {
    if (drawerIsMounted) {
      // resolve mapped parent view
      let rootViewName = getViewDrawerParentViewName(viewName);

      let foundRootViewInList = false;

      for (let x = 0; x < drawer?.list?.listElements?.length; x++) {
        let listElement = drawer?.list?.listElements[x];

        let elementViewName = listElement.attributes.getNamedItem(
          "data-react-view"
        );

        if (elementViewName) {
          elementViewName = elementViewName.value;

          if (rootViewName === elementViewName) {
            drawer.list.selectedIndex = x;
            foundRootViewInList = true;
            break;
          }
        }
      }

      if (!foundRootViewInList) {
        drawer.list.selectedIndex = -1;
      }
    }
  };

  React.useEffect(() => {
    setDrawerSelectedElement(props.selectedElement);
  }, [props?.selectedElement]);

  React.useEffect(() => {
    if (drawerIsMounted) {
      drawer.open = context.state.drawerIsOpen;

      if (
        context.state?.config?.CLOUD === true &&
        window.Intercom !== undefined
      ) {
        // show Intercom widget
        window.Intercom("update", {
          hide_default_launcher: !context.state?.drawerIsOpen,
        });
      }
    }
  }, [context.state.drawerIsOpen]);

  React.useEffect(() => {
    if (drawerRef.current) {
      const initMDCDrawer = new MDCDrawer(drawerRef.current);

      initMDCDrawer.open = context.state.drawerIsOpen;
      initMDCDrawer.list.singleSelection = true;
      initMDCDrawer.listen(
        "MDCList:action",
        /** @param {any} e */
        (e) => {
          let selectedIndex = e.detail.index;

          let listElement = initMDCDrawer.list.listElements[selectedIndex];

          if (listElement.attributes.getNamedItem("data-react-view")) {
            let viewName = listElement.attributes.getNamedItem(
              "data-react-view"
            );
            if (viewName) {
              // @ts-ignore
              viewName = viewName.value;
              orchest.loadView(nameToComponent(viewName));
            }
          }
        }
      );

      initMDCDrawer.listen("MDCDrawer:opened", () => {
        document.body.focus();
      });

      // // Avoid anchor link clicking default behavior.
      Array.from(
        window.document.querySelectorAll(".mdc-drawer a[href='#']")
      ).map((drawerLink) =>
        drawerLink.addEventListener("click", (e) => {
          e.preventDefault();
        })
      );

      setDrawer(initMDCDrawer);
    }
  }, []);

  return (
    <aside className="mdc-drawer mdc-drawer--dismissible" ref={drawerRef}>
      <div className="mdc-drawer__content">
        <nav className="mdc-list">
          <a className="mdc-list-item" data-react-view="PipelinesView" href="#">
            <span className="mdc-list-item__ripple" />
            <i
              className="material-icons mdc-list-item__graphic"
              aria-hidden="true"
            >
              device_hub
            </i>
            <span className="mdc-list-item__text">Pipelines</span>
          </a>
          <a className="mdc-list-item" data-react-view="JobsView" href="#">
            <span className="mdc-list-item__ripple" />
            <i
              className="material-icons mdc-list-item__graphic"
              aria-hidden="true"
            >
              pending_actions
            </i>
            <span className="mdc-list-item__text">Jobs</span>
          </a>
          <a
            className="mdc-list-item"
            data-react-view="EnvironmentsView"
            href="#"
          >
            <span className="mdc-list-item__ripple" />
            <i
              className="material-icons mdc-list-item__graphic"
              aria-hidden="true"
            >
              view_comfy
            </i>
            <span className="mdc-list-item__text">Environments</span>
          </a>
          <li role="separator" className="mdc-list-divider" />
          <a
            className="mdc-list-item mdc-list-item--activated"
            data-react-view="ProjectsView"
            href="#"
          >
            <span className="mdc-list-item__ripple" />
            <i
              className="material-icons mdc-list-item__graphic"
              aria-hidden="true"
            >
              format_list_bulleted
            </i>
            <span className="mdc-list-item__text">Projects</span>
          </a>
          <a
            className="mdc-list-item"
            data-react-view="FileManagerView"
            href="#"
          >
            <span className="mdc-list-item__ripple" />
            <i
              className="material-icons mdc-list-item__graphic"
              aria-hidden="true"
            >
              folder_open
            </i>
            <span className="mdc-list-item__text">File manager</span>
          </a>
          <a className="mdc-list-item" data-react-view="SettingsView" href="#">
            <span className="mdc-list-item__ripple" />
            <i
              className="material-icons mdc-list-item__graphic"
              aria-hidden="true"
            >
              settings
            </i>
            <span className="mdc-list-item__text">Settings</span>
          </a>
        </nav>
      </div>
    </aside>
  );
};

export default MainDrawer;
