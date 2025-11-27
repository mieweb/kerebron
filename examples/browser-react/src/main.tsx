import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

// Import CustomMenu CSS
import '@kerebron/extension-menu/assets/custom-menu.css';

ReactDOM.createRoot(document.getElementById('app')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
