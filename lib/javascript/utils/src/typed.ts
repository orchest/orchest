// used in orchest-webserver and mdc-components only
export function uuidv4() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
    let r = (Math.random() * 16) | 0,
      v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// used in orchest-webserver only
export function makeCancelable(promise, promiseManager) {
  let hasCanceled_ = false;

  let cancelablePromise = {
    cancel() {
      hasCanceled_ = true;
    },
    promise: undefined,
  };

  const wrappedPromise = new Promise((resolve, reject) => {
    promise.then(
      (val) => {
        hasCanceled_ ? reject({ isCanceled: true }) : resolve(val);

        promiseManager.clearCancelablePromise(cancelablePromise);
      },
      (error) => {
        hasCanceled_ ? reject({ isCanceled: true }) : reject(error);

        promiseManager.clearCancelablePromise(cancelablePromise);
      }
    );
  });

  cancelablePromise.promise = wrappedPromise;

  promiseManager.appendCancelablePromise(cancelablePromise);

  return cancelablePromise;
}

// used in orchest-webserver only
export var LANGUAGE_MAP = {
  python: "Python",
  r: "R",
  julia: "Julia",
};

// used in orchest-webserver only
export var DEFAULT_BASE_IMAGES = [
  "orchest/base-kernel-py",
  "orchest/base-kernel-py-gpu",
  "orchest/base-kernel-r",
  "orchest/base-kernel-julia",
];

// used in orchest-webserver only
export var ALLOWED_STEP_EXTENSIONS = ["ipynb", "py", "R", "sh", "jl"];

// used in orchest-webserver only
export function collapseDoubleDots(path) {
  /*
   * arg `path` can be a directory or a file.
   * (directory ends in `/`)
   *
   * collapse double dots /def/../asd/ --> /asd/
   * /def/abc/../../def/../abc --> /abc
   * */

  let pathComponents = path.split("/");
  let newPathComponents = [];
  let skipCount = 0;

  // traverse in reverse
  for (let x = pathComponents.length - 1; x >= 0; x--) {
    if (pathComponents[x] == "..") {
      // skip path that follows
      skipCount += 1;
    } else if (skipCount > 0) {
      skipCount--;
    } else {
      newPathComponents.unshift(pathComponents[x]);
    }
  }

  return newPathComponents.join("/");
}

// used in orchest-webserver only
export function absoluteToRelativePath(path, cwd) {
  // to simplify algorithm, path always end with a '/' (also for files)
  let isFile = !path.endsWith("/");
  if (isFile) {
    path = path + "/";
  }

  let relativePath = path;

  if (cwd !== undefined) {
    // path in cwd or outside
    if (path.startsWith(cwd)) {
      relativePath = path.slice(cwd.length - 1);
    } else {
      // get components /abc/def/ -> [abc, def]
      let cwdC = cwd.split("/").slice(1, -1);
      let pathC = path.split("/").slice(1, -1);

      let relativePrefixCount = 0;
      let overlappingComponents = 0;
      for (let x = 0; x < cwdC.length; x++) {
        if (cwdC[x] != pathC[x]) {
          relativePrefixCount = cwdC.length - x;
          break;
        } else {
          overlappingComponents++;
        }
      }

      relativePath =
        "/" +
        "../".repeat(relativePrefixCount) +
        pathC
          .slice(overlappingComponents)
          .map((el) => {
            return el + "/";
          })
          .join("");
    }
  }

  // remove appended slash
  if (isFile) {
    relativePath = relativePath.slice(0, -1);
  }

  return relativePath;
}

export function someParentHasClass(element, classname) {
  if (element.classList && element.classList.contains(classname)) return true;
  return (
    element.parentNode && someParentHasClass(element.parentNode, classname)
  );
}

// used in mdc-components only
export function checkHeartbeat(url, retries?) {
  if (retries === undefined) {
    retries = 250;
  }

  let tries = 0;

  let requestLambda = (resolve, reject) => {
    makeRequest("GET", url, {}, undefined, 1000)
      .then(() => {
        resolve();
      })
      .catch(() => {
        tries++;
        if (tries < retries) {
          setTimeout(() => {
            requestLambda(resolve, reject);
          }, 1000);
        } else {
          reject(retries);
        }
      });
  };

  return new Promise((resolve, reject) => {
    requestLambda(resolve, reject);
  });
}

// used in orchest-webserver only
export function extensionFromFilename(filename) {
  if (filename.indexOf(".") === -1) {
    return "";
  }
  let pieces = filename.split(".");
  return pieces[pieces.length - 1];
}

// used in orchest-webserver only
export function intersectRect(r1, r2) {
  return !(
    r2.x > r1.x + r1.width ||
    r2.x + r2.width < r1.x ||
    r2.y > r1.y + r1.height ||
    r2.y + r2.height < r1.y
  );
}

// used in orchest-webserver only
export function activeElementIsInput() {
  return document.activeElement
    ? ["TEXTAREA", "INPUT"].includes(document.activeElement.tagName)
    : false;
}

// used in orchest-webserver only
export function validURL(string) {
  let url;

  try {
    url = new URL(string);
  } catch (_) {
    return false;
  }

  return true;
}

// used in orchest-webserver only
export function kernelNameToLanguage(kernel_name) {
  let mapping = {
    ir: "r",
  };
  return mapping[kernel_name] ? mapping[kernel_name] : kernel_name;
}

// used in orchest-webserver only
export function arraysEqual(a, b) {
  return JSON.stringify(a) == JSON.stringify(b);
}

// used in orchest-webserver only
export function makeRequest(method, url, body?, onprogressCallback?, timeout?) {
  return new Promise(function (resolve, reject) {
    var xhr = new XMLHttpRequest();
    xhr.open(method, url);

    if (onprogressCallback) {
      xhr.onreadystatechange = onprogressCallback;
    }

    if (timeout === undefined) {
      timeout = 120 * 1000;
    }

    xhr.timeout = timeout; // 120 second timeout

    xhr.setRequestHeader(
      "Cache-Control",
      "no-cache, must-revalidate, post-check=0, pre-check=0"
    );

    if (body !== undefined && body.type === "json") {
      xhr.setRequestHeader("Content-Type", "application/json;charset=UTF-8");
    }

    xhr.onload = function () {
      if (this.status >= 200 && this.status < 300) {
        resolve(xhr.response);
      } else {
        reject({
          status: this.status,
          statusText: xhr.statusText,
          body: xhr.response,
        });
      }
    };
    xhr.onerror = function () {
      reject({
        status: this.status,
        statusText: xhr.statusText,
        body: xhr.response,
      });
    };

    xhr.ontimeout = function () {
      console.log("Request timed out.");
      reject({
        status: this.status,
        statusText: xhr.statusText,
        body: xhr.response,
      });
    };

    if (body !== undefined) {
      if (body.type === "json") {
        xhr.send(JSON.stringify(body.content));
      } else {
        xhr.send(body.content);
      }
    } else {
      xhr.send();
    }
  });
}

// used in orchest-webserver only
export function globalMDCVars() {
  return {
    mdcthemeprimary: "#000000",
    mdcthemesecondary: "#0a6df7",
    mdcthemebackground: "#fff",
  };
}
