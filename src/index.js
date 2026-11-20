import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";
import { Provider } from "react-redux";
import rootReducer from "./reducer";
import { configureStore } from "@reduxjs/toolkit";
import { Toaster, toast } from "react-hot-toast";
import { HashRouter } from "react-router-dom";
import { registerUnauthorizedHandler } from "./services/apiconnector";
import { setToken } from "./slices/authSlice";
import { setUser } from "./slices/profileSlice";
import { resetCart } from "./slices/cartSlice";
import { initFrontendSentry } from "./utils/sentry";

initFrontendSentry();

const root = ReactDOM.createRoot(document.getElementById("root"));

const store = configureStore({
  reducer: rootReducer,
});

// Global handler for expired/invalid JWTs on protected API calls (BUG-025)
registerUnauthorizedHandler(() => {
  store.dispatch(setToken(null));
  store.dispatch(setUser(null));
  store.dispatch(resetCart());
  toast.error("Session expired. Please log in again.");
  if (window.location.hash !== "#/login") {
    window.location.hash = "#/login";
  }
});

root.render(
  <React.StrictMode>
    <Provider store={store}>
      <HashRouter>
        <App />
        <Toaster />
      </HashRouter>
    </Provider>
  </React.StrictMode>
);
