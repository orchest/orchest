// used in orchest-webserver and mdc-components only
export function uuidv4() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
    let r = (Math.random() * 16) | 0,
      v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// used in orchest-webserver only
export const ALLOWED_STEP_EXTENSIONS = [
  "ipynb",
  "py",
  "R",
  "sh",
  "jl",
  "js",
] as const;

export type StepExtension = typeof ALLOWED_STEP_EXTENSIONS[number];

// used in mdc-components only
export function checkHeartbeat(url: string, retries = 250) {
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
export function activeElementIsInput() {
  return document.activeElement
    ? ["TEXTAREA", "INPUT"].includes(document.activeElement.tagName)
    : false;
}

// used in orchest-webserver only
export function validURL(
  url: string | undefined,
  skipHttpsChecking = false
): url is string {
  if (!url) return false;

  try {
    const isValidUrl = /^https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{2,256}\.[a-z]{2,6}\b[^\s]*$/g.test(
      url
    );

    return skipHttpsChecking
      ? isValidUrl
      : isValidUrl && url.startsWith("https");
  } catch (e) {
    return false;
  }
}

export function validGitRepo(url: string) {
  return /((http|git|ssh|http(s)|file|\/?)|(git@[\w\.]+))(:(\/\/)?)([\w\.@\:/\-~]+)(\.git)(\/)?/.test(
    url
  );
}

// used in orchest-webserver only
export function kernelNameToLanguage(kernel_name: string): string {
  let mapping = {
    ir: "r",
  };
  return mapping[kernel_name] || kernel_name;
}

// used in orchest-webserver only
export function arraysEqual(a, b) {
  return JSON.stringify(a) == JSON.stringify(b);
}

// used in orchest-webserver only
export function makeRequest(method, url, body?, onprogressCallback?, timeout?) {
  return new Promise<string>(function (resolve, reject) {
    let xhr = new XMLHttpRequest();
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

/**
 * A simple function that checks if a variable is not undefined, nor null
 * @param variable any arbitrary variable
 * @returns boolean
 */
export const hasValue = <T>(variable: T | undefined | null): variable is T => {
  return variable !== undefined && variable !== null;
};
