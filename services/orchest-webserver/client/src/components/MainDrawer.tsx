import React from "react";
import { NavLink, useParams } from "react-router-dom";
import { MDCDrawer } from "@material/drawer";
import { useOrchest } from "@/hooks/orchest";
// import { getViewDrawerParentViewName } from "../utils/webserver-utils";

import { generatePathFromRoute, siteMap } from "../routingConfig";

const getProjectMenuItems = (projectId: string) => [
  {
    label: "Pipelines",
    icon: "device_hub",
    path: generatePathFromRoute(siteMap.pipelines.path, { projectId }),
  },
  {
    label: "Jobs",
    icon: "pending_actions",
    path: generatePathFromRoute(siteMap.jobs.path, { projectId }),
  },
  {
    label: "Environments",
    icon: "view_comfy",
    path: generatePathFromRoute(siteMap.environments.path, { projectId }),
  },
];

const rootMenuItems = [
  {
    label: "Projects",
    icon: "format_list_bulleted",
    path: siteMap.projects.path,
  },
  {
    label: "File manager",
    icon: "folder_open",
    path: siteMap.fileManager.path,
  },
  {
    label: "Settings",
    icon: "settings",
    path: siteMap.settings.path,
  },
] as const;

type ItemData = { label: string; icon: string; path: string };

const MenuItem: React.FC<{ item: ItemData; id: string }> = ({ item, id }) => {
  return (
    <NavLink
      to={item.path}
      className="mdc-list-item"
      activeClassName="mdc-list-item--selected"
      data-test-id={id}
    >
      <span className="mdc-list-item__ripple" />
      <i className="material-icons mdc-list-item__graphic" aria-hidden="true">
        {item.icon}
      </i>
      <span className="mdc-list-item__text">{item.label}</span>
    </NavLink>
  );
};

const getItemKey = (item: { label: string; icon: string; path: string }) =>
  `menu-${item.label.toLowerCase().replace(/[\W]/g, "-")}`;

const MainDrawer: React.FC = () => {
  const context = useOrchest();
  const projectId = context.state.project_uuid;

  const { projectId: foo } = useParams<{ projectId: string }>();
  // TODO: why foo is empty?
  console.log(`🤞`);
  console.log(foo);
  console.log(projectId);
  console.log(context.state.project_uuid);

  const projectMenuItems = getProjectMenuItems(projectId);

  const drawerRef = React.useRef(null);
  // const [drawer, setDrawer] = React.useState(null);
  // const drawerIsMounted = drawerRef && drawer != null;

  // const setDrawerSelectedElement = (viewName) => {
  //   if (drawerIsMounted) {
  //     // resolve mapped parent view
  //     const rootViewName = getViewDrawerParentViewName(viewName);

  //     const selectedView = drawer?.list?.listElements
  //       ?.map((listElement, i) => ({
  //         index: i,
  //         view: listElement.attributes.getNamedItem("data-react-view")?.value,
  //       }))
  //       ?.find((listElement) => listElement.view === rootViewName);

  //     drawer.list.selectedIndex =
  //       selectedView !== undefined ? selectedView.index : -1;
  //   }
  // };

  // React.useEffect(() => {
  //   setDrawerSelectedElement(props.selectedElement);
  // }, [props?.selectedElement]);

  React.useEffect(() => {
    if (drawerRef.current) {
      // drawer.open = context.state.drawerIsOpen;

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

      initMDCDrawer.listen("MDCDrawer:opened", () => {
        document.body.focus();
      });

      // setDrawer(initMDCDrawer);
    }
  }, []);

  return (
    <aside className="mdc-drawer mdc-drawer--dismissible" ref={drawerRef}>
      <div className="mdc-drawer__content">
        <nav className="mdc-list">
          {projectMenuItems.map((item) => {
            const id = getItemKey(item);
            return <MenuItem key={id} id={id} item={item} />;
          })}
          <hr role="separator" className="mdc-list-divider" />
          {rootMenuItems.map((item) => {
            const id = getItemKey(item);
            return <MenuItem key={id} id={id} item={item} />;
          })}
        </nav>
      </div>
    </aside>
  );
};

export default MainDrawer;
