import { useAppContext } from "@/contexts/AppContext";
import { Position } from "@/types";
import { getOffset } from "@/utils/jquery-replacement";
import React from "react";
import { getScaleCorrectedPosition } from "../common";
import { usePipelineEditorContext } from "../contexts/PipelineEditorContext";
import { STEP_HEIGHT, STEP_WIDTH } from "../PipelineStep";
import { baseNameFromPath, queryArgs, unpackCombinedPath } from "./common";
import { ContextMenuType } from "./FileManagerContextMenu";

export type FileManagerContextType = {
  getDropPosition: () => Position;
  handleClose: () => void;
  handleContextMenu: (
    event: React.MouseEvent,
    combinedPath: string,
    type?: ContextMenuType
  ) => void;
  handleSelect: (
    event: React.SyntheticEvent<Element, Event>,
    selected: string[]
  ) => void;
  handleContextEdit: () => void;
  handleContextView: () => void;
  handleDelete: () => void;
  handleDownload: () => void;
  handleDuplicate: () => Promise<void>;
  handleContextRename: () => void;
  contextMenuCombinedPath: string;
  fileInRename: string;
  setFileInRename: React.Dispatch<React.SetStateAction<string>>;
  fileRenameNewName: string;
  setFileRenameNewName: React.Dispatch<React.SetStateAction<string>>;
};

export const FileManagerContext = React.createContext<FileManagerContextType>(
  null
);

export const useFileManagerContext = () => React.useContext(FileManagerContext);

const deleteFetch = (baseUrl: string, combinedPath: string) => {
  let { root, path } = unpackCombinedPath(combinedPath);
  return fetch(`${baseUrl}/delete?${queryArgs({ path, root })}`, {
    method: "POST",
  });
};

const getBaseNameFromContextMenu = (contextMenuCombinedPath: string) => {
  let pathComponents = contextMenuCombinedPath.split("/");
  if (contextMenuCombinedPath.endsWith("/")) {
    pathComponents = pathComponents.slice(0, -1);
  }
  return pathComponents.slice(-1)[0];
};

const downloadFile = (
  url: string,
  combinedPath: string,
  downloadLink: string
) => {
  let { root, path } = unpackCombinedPath(combinedPath);

  let downloadUrl = `${url}/download?${queryArgs({
    path,
    root,
  })}`;
  const a = document.createElement("a");
  a.href = downloadUrl;
  a.download = downloadLink;
  document.body.appendChild(a);
  a.click();
  a.remove();
};

export const FileManagerContextProvider: React.FC<{
  baseUrl: string;
  reload: () => Promise<void>;
  onSelect?: (selected: string[]) => void;
  // onDropOutside: (target: EventTarget, selection: string[]) => void;
  // onOpen: (filePath: string) => void;
  onEdit: (filePath: string) => void;
  onView: (filePath: string) => void;
  setContextMenu: React.Dispatch<
    React.SetStateAction<{
      position: Position;
      type: ContextMenuType;
    }>
  >;
}> = ({
  children,
  onSelect,
  onView,
  onEdit,
  baseUrl,
  reload,
  setContextMenu,
}) => {
  const { setConfirm } = useAppContext();
  const {
    mouseTracker,
    eventVars,
    pipelineCanvasRef,
  } = usePipelineEditorContext();
  const [contextMenuCombinedPath, setContextMenuPath] = React.useState<
    string
  >();
  const [selected, setSelected] = React.useState<string[]>([]);
  const [fileInRename, setFileInRename] = React.useState<string>(undefined);
  const [fileRenameNewName, setFileRenameNewName] = React.useState("");

  const getDropPosition = React.useCallback((): Position => {
    const clientPosition = {
      x: mouseTracker.current.client.x - STEP_WIDTH / 2,
      y: mouseTracker.current.client.y - STEP_HEIGHT / 2,
    };
    const { x, y } = getScaleCorrectedPosition({
      offset: getOffset(pipelineCanvasRef.current),
      position: clientPosition,
      scaleFactor: eventVars.scaleFactor,
    });

    return { x, y };
  }, [eventVars.scaleFactor, mouseTracker, pipelineCanvasRef]);

  const handleContextMenu = React.useCallback(
    (
      event: React.MouseEvent,
      combinedPath: string,
      type: ContextMenuType = "tree"
    ) => {
      event.preventDefault();
      event.stopPropagation();
      setContextMenuPath(combinedPath);
      setContextMenu((current) => {
        return current === null
          ? {
              position: {
                x: event.clientX - 2,
                y: event.clientY - 4,
              },
              type,
            }
          : null;
      });
    },
    [setContextMenu]
  );

  const handleSelect = React.useCallback(
    (event: React.SyntheticEvent<Element, Event>, selected: string[]) => {
      if (onSelect) onSelect(selected);
      setSelected(selected);
    },
    [onSelect]
  );

  const handleClose = React.useCallback(() => {
    setContextMenu(null);
  }, [setContextMenu]);

  const handleContextEdit = React.useCallback(() => {
    handleClose();
    onEdit(contextMenuCombinedPath);
  }, [contextMenuCombinedPath, handleClose, onEdit]);

  const handleContextView = React.useCallback(() => {
    handleClose();
    onView(contextMenuCombinedPath);
  }, [contextMenuCombinedPath, handleClose, onView]);

  const handleContextRename = React.useCallback(() => {
    handleClose();
    setFileInRename(contextMenuCombinedPath);
    setFileRenameNewName(baseNameFromPath(contextMenuCombinedPath));
  }, [contextMenuCombinedPath, handleClose]);

  const handleDuplicate = React.useCallback(async () => {
    handleClose();

    let { root, path } = unpackCombinedPath(contextMenuCombinedPath);

    await fetch(
      `${baseUrl}/duplicate?${queryArgs({
        path,
        root,
      })}`,
      { method: "POST" }
    );
    reload();
  }, [baseUrl, contextMenuCombinedPath, handleClose, reload]);

  const handleDelete = React.useCallback(() => {
    handleClose();

    if (selected.includes(contextMenuCombinedPath) && selected.length > 1) {
      setConfirm(
        "Warning",
        `Are you sure you want to delete ${selected.length} files?`,
        async (resolve) => {
          await Promise.all(
            selected.map((combinedPath) => deleteFetch(baseUrl, combinedPath))
          );
          await reload();
          resolve(true);
          return true;
        }
      );
      return;
    }

    setConfirm(
      "Warning",
      `Are you sure you want to delete '${getBaseNameFromContextMenu(
        contextMenuCombinedPath
      )}'?`,
      async (resolve) => {
        await deleteFetch(baseUrl, contextMenuCombinedPath);
        await reload();
        resolve(true);
        return true;
      }
    );
  }, [
    contextMenuCombinedPath,
    selected,
    baseUrl,
    reload,
    setConfirm,
    handleClose,
  ]);

  const handleDownload = React.useCallback(() => {
    handleClose();

    const downloadLink = getBaseNameFromContextMenu(contextMenuCombinedPath);

    if (selected.includes(contextMenuCombinedPath)) {
      selected.forEach((combinedPath, i) => {
        setTimeout(function () {
          downloadFile(baseUrl, combinedPath, downloadLink);
        }, i * 500);
        // Seems like multiple download invocations works with 500ms
        // Not the most reliable, might want to fall back to server side zip.
      });
    } else {
      downloadFile(baseUrl, contextMenuCombinedPath, downloadLink);
    }
  }, [baseUrl, contextMenuCombinedPath, handleClose, selected]);

  return (
    <FileManagerContext.Provider
      value={{
        getDropPosition,
        handleClose,
        handleContextMenu,
        handleSelect,
        handleContextEdit,
        handleContextView,
        handleDelete,
        handleDownload,
        handleDuplicate,
        handleContextRename,
        contextMenuCombinedPath,
        fileInRename,
        setFileInRename,
        fileRenameNewName,
        setFileRenameNewName,
      }}
    >
      {children}
    </FileManagerContext.Provider>
  );
};
