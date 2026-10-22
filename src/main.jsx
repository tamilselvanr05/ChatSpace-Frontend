import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import {
    BrowserRouter,
    Routes,
    Route
} from "react-router-dom";

import "./index.css";

import Login from "./login.jsx";
import Signup from "./signup.jsx";
import App from "./App.jsx";
import Profile from "./profile.jsx";
import Settings from "./Settings.jsx";
import Themes from "./Themes.jsx";
import SettingsDetail from "./SettingsDetail.jsx";

createRoot(document.getElementById("root")).render(
    <StrictMode>

        <BrowserRouter>

            <Routes>

                <Route
                    path="/"
                    element={<Login />}
                />

                <Route
                    path="/signup"
                    element={<Signup />}
                />

                <Route
                    path="/chat"
                    element={<App />}
                />

                <Route
                    path="/profile"
                    element={<Profile />}
                />

                <Route
                    path="/settings"
                    element={<Settings />}
                />

                <Route
                    path="/themes"
                    element={<Themes />}
                />

                <Route
                    path="/privacy"
                    element={<SettingsDetail />}
                />

                <Route
                    path="/security"
                    element={<SettingsDetail />}
                />

                <Route
                    path="/chat-background"
                    element={<SettingsDetail />}
                />

                <Route
                    path="/message-style"
                    element={<SettingsDetail />}
                />

                <Route
                    path="/notifications"
                    element={<SettingsDetail />}
                />

                <Route
                    path="/sound"
                    element={<SettingsDetail />}
                />

                <Route
                    path="/about"
                    element={<SettingsDetail />}
                />

            </Routes>

        </BrowserRouter>

    </StrictMode>
);