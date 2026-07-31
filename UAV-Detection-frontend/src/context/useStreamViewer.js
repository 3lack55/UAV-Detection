import { useContext } from "react";
import { StreamViewerContext } from "./stream-viewer-context-definition";

export const useStreamViewer = () => {
  const context = useContext(StreamViewerContext);
  return context ?? {
    frame: null,
    metaData: null,
    status: "Disconnected",
    fpsDisplay: 0,
    isCameraConnected: false,
    sendControlMessage: () => {},
    controlFeedback: null,
  };
};
