import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';   // global styles — loaded once here, apply to the whole app
import './styles/mtms-design.css';   // mt- design system (redesigned 10-role shell + components)

// ReactDOM.createRoot finds the <div id="root"> in index.html
// and tells React to take control of it.
// From this point on, React manages everything inside that div.
ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    {/*
      StrictMode is a development tool.
      It runs each component twice to help catch bugs.
      It has no effect in production builds.
    */}
    <App />
  </React.StrictMode>
);
