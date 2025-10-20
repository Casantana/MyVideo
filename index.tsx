import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

// This script is now a content script, which runs on YouTube pages.
// It needs to create its own environment to render the React app.

// Inject the Tailwind CSS CDN into the page's <head>
// We check if it already exists to avoid adding it multiple times.
if (!document.getElementById('tailwind-cdn-script')) {
  const tailwindScript = document.createElement('script');
  tailwindScript.id = 'tailwind-cdn-script';
  tailwindScript.src = 'https://cdn.tailwindcss.com';
  document.head.appendChild(tailwindScript);
}

// Create a root container for our React app.
// The app will live inside this div.
const rootDiv = document.createElement('div');
rootDiv.id = 'voxly-chrome-extension-root';
document.body.appendChild(rootDiv);

// Render the React application into our new root container.
const root = ReactDOM.createRoot(rootDiv);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
