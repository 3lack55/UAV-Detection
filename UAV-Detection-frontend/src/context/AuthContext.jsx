import { createContext, useContext, useState, useEffect } from "react";

const AuthContext = createContext();

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [redirectUrl, setRedirectUrl] = useState(null);

    useEffect(() => {
        const token = sessionStorage.getItem("token");
        const user_id = sessionStorage.getItem("user_id");
        const username = sessionStorage.getItem("username");
        const role = sessionStorage.getItem("role");
        const profile_image = sessionStorage.getItem("profile_image");
        if (token) {
            setUser({ token, username, user_id, role, profile_image });
        }
        setLoading(false);
    }, []);

    const login = (token, username, user_id, role, profile_image) => {
        sessionStorage.setItem("token", token);
        sessionStorage.setItem("username", username);
        sessionStorage.setItem("user_id", user_id);
        sessionStorage.setItem("role", role);
        sessionStorage.setItem("profile_image", profile_image);
        setUser({ token, username, user_id, role, profile_image });
    };

    const logout = () => {
        sessionStorage.removeItem("token");
        sessionStorage.removeItem("username");
        sessionStorage.removeItem("user_id");
        sessionStorage.removeItem("role");
        sessionStorage.removeItem("profile_image");
        setUser(null);
    };

    const saveRedirectUrl = (url) => {
        sessionStorage.setItem("redirectUrl", url);
        setRedirectUrl(url);
    };

    const getRedirectUrl = () => {
        const url = sessionStorage.getItem("redirectUrl") || redirectUrl;
        return url;
    };

    const clearRedirectUrl = () => {
        sessionStorage.removeItem("redirectUrl");
        setRedirectUrl(null);
    };

    return (
        <AuthContext.Provider value={{ user, login, logout, loading, saveRedirectUrl, getRedirectUrl, clearRedirectUrl }}>
            {children}
        </AuthContext.Provider>
    );
}

export const useAuth = () => useContext(AuthContext);
