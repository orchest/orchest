export const copyToClipboard = (textToCopy: string) => {
  // navigator clipboard api needs a secure context (https)
  if (navigator.clipboard && window.isSecureContext) {
    // navigator clipboard api method'
    return navigator.clipboard.writeText(textToCopy);
  } else {
    // This works around for non-https.
    let textArea = document.createElement("textarea");
    textArea.value = textToCopy;
    // make the textarea out of viewport
    textArea.style.position = "fixed";
    textArea.style.left = "-999999px";
    textArea.style.top = "-999999px";
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    return new Promise((res, rej) => {
      // `document.execCommand` has been deprecated.
      // However, it is kept here for running in a dev environment.
      document.execCommand("copy") ? res(undefined) : rej();
      textArea.remove();
    });
  }
};
