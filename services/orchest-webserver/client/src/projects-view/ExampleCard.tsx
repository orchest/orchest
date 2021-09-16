import React from "react";
import classNames from "classnames";
import GitHubButton from "react-github-btn";

import { MDCButtonReact, MDCTooltipReact } from "@orchest/lib-mdc";
import { Example } from "@/types";

type ExampleCardProps = Example & {
  startImport: (url: string) => void;
};

const MAX_TAG_NUMBER = 3;

const ExampleCard: React.FC<ExampleCardProps> = ({
  title,
  description,
  tags,
  owner,
  url,
  startImport,
}) => {
  const importExample = () => startImport(url);
  const isOwnedByOrchest = owner === "orchest";

  const restNumber = Math.max(tags.length - MAX_TAG_NUMBER, 0);
  const shownTags = restNumber > 0 ? tags.slice(0, MAX_TAG_NUMBER) : tags;
  const extraTags = restNumber > 0 ? tags.slice(MAX_TAG_NUMBER) : [];

  return (
    <div className="example-card">
      <div className="example-tags-container">
        {shownTags.map((tag) => (
          <span key={tag} className="example-tag truncate" title={tag}>
            {tag}
          </span>
        ))}
        {restNumber > 0 && (
          <>
            <span
              className="example-tag__extra"
              aria-describedby={"tooltip-example-extra-tags"}
            >{`+${restNumber}`}</span>
            <MDCTooltipReact
              tooltipID="tooltip-example-extra-tags"
              tooltip={extraTags.map((extraTag) => (
                <div key={extraTag} className="example-tag__tooltip">
                  {extraTag.toUpperCase()}
                </div>
              ))}
            />
          </>
        )}
      </div>
      <h4 className="example-card-title truncate">{title}</h4>
      <div className="example-card-owner">
        by
        <span
          className={classNames([
            "example-card-owner-name",
            isOwnedByOrchest ? "capitalized" : "",
          ])}
        >
          {owner}
        </span>
      </div>
      <p className="example-card-description">{description}</p>
      <div
        className="example-card-button-container"
        style={{
          justifyContent: isOwnedByOrchest ? "flex-end" : "space-between",
        }}
      >
        {!isOwnedByOrchest && (
          <div className="github-start-button-container">
            <GitHubButton
              href={url}
              data-icon="octicon-star"
              data-size="large"
              data-show-count="true"
              aria-label={`Star "${title}" on GitHub`}
            >
              Star
            </GitHubButton>
          </div>
        )}
        <MDCButtonReact
          label="IMPORT"
          classNames={["example-import-button"]}
          onClick={importExample}
        />
      </div>
    </div>
  );
};

export { ExampleCard };
