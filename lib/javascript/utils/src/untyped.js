import React from "react";

// used in orchest-webserver and mdc-components only
export class RefManager {
  constructor() {
    this._refs = {};

    this.refs = new Proxy(this._refs, {
      get: (target, name, receiver) => {
        if (!target[name]) {
          return;
        }
        return target[name].current;
      },
      set: (target, name, value, receiver) => {
        target[name] = value;
      },
    });

    this.nrefs = new Proxy(this._refs, {
      get: (target, name, receiver) => {
        if (!target[name]) {
          target[name] = new React.createRef();
        }

        return target[name];
      },
    });
  }
}

// used in orchest-webserver only
export class PromiseManager {
  constructor() {
    this.cancelablePromises = [];
  }

  appendCancelablePromise(cancelablePromise) {
    this.cancelablePromises.push(cancelablePromise);
  }

  cancelCancelablePromises() {
    for (let cancelablePromise of this.cancelablePromises) {
      cancelablePromise.cancel();
    }
  }

  clearCancelablePromise(cancelablePromise) {
    let index = this.cancelablePromises.indexOf(cancelablePromise);
    this.cancelablePromises.splice(index, 1);
  }
}
