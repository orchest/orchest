import { MDCList } from "@material/list";
import { RefManager } from "@orchest/lib-utils";
import React from "react";

export type MDCItemList = Array<{ text: string; onClick?: any }>;

const MDCListReact: React.FC<{
  items: MDCItemList;
  selectedIndex: number;
  className?: string;
  style?: React.CSSProperties;
}> = ({ items, selectedIndex, className, style }) => {
  const [refManager] = React.useState(new RefManager());

  React.useEffect(() => {
    new MDCList(refManager.refs.mdcList);
  }, []);

  let indexBound = (func, index) => {
    return () => {
      func(index);
    };
  };

  return (
    <ul
      className={"mdc-deprecated-list " + className ? className : ""}
      style={style}
      ref={refManager.nrefs.mdcList}
    >
      {items.map((item, index) => {
        return (
          <li
            onClick={item.onClick ? indexBound(item.onClick, index) : undefined}
            key={index}
            className={
              "mdc-deprecated-list-item " +
              (index == selectedIndex
                ? "mdc-deprecated-list-item--selected"
                : "")
            }
          >
            <span className="mdc-deprecated-list-item__ripple"></span>
            <span className="mdc-deprecated-list-item__text">{item.text}</span>
          </li>
        );
      })}
    </ul>
  );
};

export { MDCListReact };
