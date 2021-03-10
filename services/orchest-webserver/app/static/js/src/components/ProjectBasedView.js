import React from "react";

class ProjectBasedView extends React.Component {
  constructor(props) {
    super(props);
  }

  render() {
    let TagName = this.props.childView;

    return (
      <div className="view-page">
        {(() => {
          if (this.props.project_uuid) {
            // TODO: remove key: ... property on childview. Requires al childviews to support property swapping.
            return (
              <TagName
                {...{
                  ...this.props.childViewProps,
                  ...{
                    project_uuid: this.props.project_uuid,
                    key: this.props.project_uuid,
                  },
                }}
              />
            );
          }
        })()}
      </div>
    );
  }
}

export default ProjectBasedView;
