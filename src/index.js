import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";
import { Provider } from 'react-redux';
import rootReducer from "./reducer";
import { configureStore } from "@reduxjs/toolkit";  
import { Toaster } from "react-hot-toast";
import { HashRouter } from "react-router-dom";

const root = ReactDOM.createRoot(document.getElementById("root"));

const store = configureStore({
  reducer:rootReducer,
})

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
