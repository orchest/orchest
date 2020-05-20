import {
  JupyterFrontEnd, JupyterFrontEndPlugin
} from '@jupyterlab/application';

import {
  NotebookTools, INotebookTracker, NotebookPanel, INotebookTools, Notebook
} from '@jupyterlab/notebook';

import {
  CodeCell,
} from '@jupyterlab/cells';

/**
 * The plugin registration information.
 */
const plugin: JupyterFrontEndPlugin<void> = {
  activate: (
    app: JupyterFrontEnd,
    tracker: INotebookTracker,
  ) => {
    new VisualTagsExtension(tracker, app);
  },
  id: 'visualtags:visualtagsPlugin',
  autoStart: true,
  requires: [INotebookTracker]
};


/**
 * A notebook extension that adds visual cell tags to Notebook cells.
 */
export
  class VisualTagsExtension extends NotebookTools.Tool {

  constructor(tracker: INotebookTracker, app: JupyterFrontEnd) {
    super();
    this.tracker = tracker;
    this.app = app;

    document.addEventListener("mouseup", this._setChangeListener.bind(this));
    document.addEventListener("mousedown", this._openPropertiesListener.bind(this));

    document.addEventListener("keydown", this._setChangeListener.bind(this));

    this.tracker.currentChanged.connect(this._setChangeListener, this);
  }

  _openPropertiesListener(e: MouseEvent) {
    let target = e.target as HTMLElement;
    if (target.classList.contains("visual-cell-tags") ||
      (target.parentElement
        && target.parentElement.classList.contains("visual-cell-tags"))) {

      // set active cell
      if(this.tracker.currentWidget){
        let visualCellTags = target;

        if(!visualCellTags.classList.contains("visual-cell-tags")){
          visualCellTags = target.parentElement;
        }

        let cellIndex = parseInt(visualCellTags.attributes.getNamedItem("data-cell-index").value);
        let notebook = this.tracker.currentWidget as NotebookPanel;
        notebook.content.activeCellIndex = cellIndex;
      }

      this.app.shell.activateById("jp-property-inspector")
    }

  }

  _setChangeListener() {

    if (!this.tracker.currentWidget.isRevealed) {
      this.tracker.currentWidget.revealed.then(() => {
        this._iterateCells(this.tracker.currentWidget);
      });
    }
    else if (this.tracker.currentWidget) {

      // time out to make sure tag has been processed to cell metadata (call stack clear)
      this._iterateCells(this.tracker.currentWidget);
    }
  }

  /**
   * We're adding the cell tags HTML element to the InputArea because 
   * it will hide the cell tags for Markdown cells when they are rendered.
   * This is considered consistent with Jupyter practice of hiding MD 
   * source/editor when a cell is rendered.
   */

  _updateCellTagDom(node: HTMLElement, tags: Array<string>, cellIndex: Number) {
    let cellTagRoot = node.querySelector(".visual-cell-tags");

    if (tags.length === 0) {
      if (cellTagRoot !== null) {
        cellTagRoot.remove();
        cellTagRoot = null;
      }
    }
    else if (cellTagRoot === null) {
      let jpInputAreaEditor = node.querySelector(".jp-InputArea-editor");

      if (jpInputAreaEditor !== null) {

        cellTagRoot = document.createElement("div")
        cellTagRoot.classList.add("visual-cell-tags");

        let labelEl = document.createElement("div");
        labelEl.classList.add("label");
        labelEl.innerText = "Cell tags";

        cellTagRoot.appendChild(labelEl);

        jpInputAreaEditor.prepend(cellTagRoot);

      } else {
        console.warn("Class .jp-InputArea-editor not found. Probably because Jupyter has changed their internal classnames/HTML structure.")
      }

    }

    if (cellTagRoot !== null) {
      let tagsToAdd = tags.slice();
      let tagEls = cellTagRoot.querySelectorAll(".cell-tag");

      let dataCellIndexAttribute = document.createAttribute('data-cell-index');
      dataCellIndexAttribute.value = cellIndex + "";
      cellTagRoot.attributes.setNamedItem(dataCellIndexAttribute);

      for (let x = 0; x < tagEls.length; x++) {
        let tagEl = tagEls[x];

        if (tags.indexOf(tagEl.textContent) > -1) {
          tagsToAdd.splice(tagsToAdd.indexOf(tagEl.textContent), 1);
        } else {
          tagEl.remove();
        }
      }

      for (let x = 0; x < tagsToAdd.length; x++) {
        let tagEl = document.createElement('div');
        tagEl.classList.add("cell-tag")
        tagEl.innerText = tagsToAdd[x];
        cellTagRoot.appendChild(tagEl);
      }
    }

  }

  _iterateCells(notebook: NotebookPanel) {
    const cells = notebook.content.widgets as Array<CodeCell>;

    for (let i = 0; i < cells.length; i++) {
      let cell = cells[i];

      const metadata = cell.model.metadata;
      const tags = metadata.get('tags') as Array<string>;
      if (tags) {
        this._updateCellTagDom(cell.node, tags, i);
      } else {
        this._updateCellTagDom(cell.node, [], i);
      }
    }
  }

  private tracker: INotebookTracker = null;
  private app: JupyterFrontEnd = null;
}


/**
 * Export the plugin as default.
 */
export default plugin;