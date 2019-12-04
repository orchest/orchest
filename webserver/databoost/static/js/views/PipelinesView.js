import React from 'react';

import {MDCList} from '@material/list';

class PipelineListItem extends React.Component {

    render() {
        return <li className="mdc-list-item" role="checkbox" aria-checked="false">
          <span className="mdc-list-item__graphic">
            <div className="mdc-checkbox">
              <input type="checkbox"
                     className="mdc-checkbox__native-control"
                     id="demo-list-checkbox-item-1"/>
              <div className="mdc-checkbox__background">
                <svg className="mdc-checkbox__checkmark"
                     viewBox="0 0 24 24">
                  <path className="mdc-checkbox__checkmark-path"
                        fill="none"
                        d="M1.73,12.91 8.1,19.28 22.79,4.59"/>
                </svg>
                <div className="mdc-checkbox__mixedmark"></div>
              </div>
            </div>
          </span>
            <label className="mdc-list-item__text" htmlFor="demo-list-checkbox-item-1">Option 1</label>
        </li>;
    }
}

class PipelinesView extends React.Component {

    componentWillUnmount() {

    }

    componentDidMount() {
        this.mdcList = new MDCList(this.refs.mdcList);

        this.mdcList.listen("MDCList:action", (e) => {
            console.log(this.mdcList)
        })
    }

    render() {
        return <div className={"view-page"}>
            <h2>Pipelines</h2>
            <ul className="mdc-list" ref={"mdcList"} role="group" aria-label="List with checkbox items">
                <PipelineListItem />
                <PipelineListItem />
            </ul>
        </div>;
    }
}

export default PipelinesView;