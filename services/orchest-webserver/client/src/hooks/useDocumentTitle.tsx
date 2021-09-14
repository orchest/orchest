import React from "react";

const useDocumentTitle = (title: string) => {
  React.useEffect(() => {
    if (title) {
      window.document.title = title;
    }
  }, [title]);
};

export { useDocumentTitle };
