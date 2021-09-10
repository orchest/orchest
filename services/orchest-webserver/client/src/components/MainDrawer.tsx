import React, { useRef } from "react";
import { NavLink } from "react-router-dom";
import { MDCDrawer } from "@material/drawer";
import { useOrchest } from "@/hooks/orchest";

import { generatePathFromRoute, siteMap } from "../routingConfig";

const getProjectMenuItems = (projectUuid: string) => [
  {
    label: "Pipelines",
    icon: "device_hub",
    path: generatePathFromRoute(siteMap.pipelines.path, { projectUuid }),
  },
  {
    label: "Jobs",
    icon: "pending_actions",
    path: generatePathFromRoute(siteMap.jobs.path, { projectUuid }),
  },
  {
    label: "Environments",
    icon: "view_comfy",
    path: generatePathFromRoute(siteMap.environments.path, { projectUuid }),
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

const MenuItem: React.FC<{ item: ItemData; id: string; exact?: boolean }> = ({
  item,
  id,
  exact = false,
}) => {
  return (
    <NavLink
      to={item.path}
      className="mdc-list-item"
      activeClassName="mdc-list-item--selected"
      exact={exact}
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
  const projectUuid = context.state.project_uuid;

  const projectMenuItems = getProjectMenuItems(projectUuid);

  const drawerRef = useRef(null);
  const macDrawerRef = useRef(null);

  React.useEffect(() => {
    if (drawerRef.current) {
      if (macDrawerRef.current)
        macDrawerRef.current.open = context.state.drawerIsOpen;

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

      macDrawerRef.current = initMDCDrawer;
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
            // these items are at the root level, we need to set exact to true
            // otherwise, when path is /projects/12345, "Projects" will still be in active state.
            return <MenuItem key={id} id={id} item={item} exact />;
          })}
        </nav>
      </div>
    </aside>
  );
};

export default MainDrawer;
