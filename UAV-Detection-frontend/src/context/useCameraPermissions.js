import { useContext } from "react";
import { CameraPermissionContext } from "./camera-permission-context-definition";

export const useCameraPermissions = () => useContext(CameraPermissionContext);
