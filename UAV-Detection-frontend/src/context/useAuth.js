import { useContext } from "react";
import { AuthContext } from "./auth-context-definition";

export const useAuth = () => useContext(AuthContext);
