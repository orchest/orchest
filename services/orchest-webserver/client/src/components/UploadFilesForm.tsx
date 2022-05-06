import React from "react";

export const UploadFilesForm: React.FC<{
  folder?: boolean;
  multiple?: boolean;
  upload: (files: FileList) => Promise<void> | void;
  children: (onClick: () => void) => React.ReactNode;
}> = ({ upload, folder, multiple = true, children }) => {
  const props = folder ? { webkitdirectory: "", directory: "" } : { multiple };
  const inputRef = React.useRef<HTMLInputElement | null>(null);

  const onClick = React.useCallback(() => {
    if (inputRef.current) inputRef.current.click();
  }, []);

  const doUpload = () => {
    if (inputRef.current?.files) upload(inputRef.current.files);
  };

  return (
    <>
      <form style={{ display: "none" }}>
        <input type="file" {...props} onChange={doUpload} ref={inputRef} />
      </form>
      {children(onClick)}
    </>
  );
};
