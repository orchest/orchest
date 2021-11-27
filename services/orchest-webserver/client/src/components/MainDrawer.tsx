import { useAppContext } from "@/contexts/AppContext";
import { useOrchest } from "@/hooks/orchest";
import { MDCDrawer } from "@material/drawer";
import React, { useRef } from "react";
import { NavLink } from "react-router-dom";
import { siteMap, toQueryString } from "../routingConfig";

const getProjectMenuItems = (projectUuid: string) => [
  {
    label: "Pipelines",
    icon: "device_hub",
    path: `${siteMap.pipelines.path}${toQueryString({ projectUuid })}`,
  },
  {
    label: "Jobs",
    icon: "pending_actions",
    path: `${siteMap.jobs.path}${toQueryString({ projectUuid })}`,
  },
  {
    label: "Environments",
    icon: "view_comfy",
    path: `${siteMap.environments.path}${toQueryString({ projectUuid })}`,
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
      className="mdc-deprecated-list-item"
      activeClassName="mdc-deprecated-list-item--selected"
      exact={exact}
      data-test-id={id}
    >
      <span className="mdc-deprecated-list-item__ripple" />
      <i
        className="material-icons mdc-deprecated-list-item__graphic"
        aria-hidden="true"
      >
        {item.icon}
      </i>
      <span className="mdc-deprecated-list-item__text">{item.label}</span>
    </NavLink>
  );
};

const getItemKey = (item: { label: string; icon: string; path: string }) =>
  `menu-${item.label.toLowerCase().replace(/[\W]/g, "-")}`;

const MainDrawer: React.FC<{ isOpen: boolean }> = ({ isOpen }) => {
  const context = useOrchest();
  const appContext = useAppContext();
  const projectUuid = context.state.projectUuid;

  const projectMenuItems = getProjectMenuItems(projectUuid);

  const drawerRef = useRef(null);
  const macDrawerRef = useRef(null);

  React.useEffect(() => {
    if (drawerRef.current) {
      if (macDrawerRef.current) macDrawerRef.current.open = isOpen;

      if (appContext.state.config?.CLOUD && window.Intercom !== undefined) {
        // show Intercom widget
        window.Intercom("update", {
          hide_default_launcher: !isOpen,
        });
      }
    }
  }, [isOpen]);

  React.useEffect(() => {
    if (drawerRef.current) {
      const initMDCDrawer = new MDCDrawer(drawerRef.current);

      initMDCDrawer.open = isOpen;
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
          <hr role="separator" className="mdc-deprecated-list-divider" />
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
