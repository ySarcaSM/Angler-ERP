import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './context/AuthContext';
import App from './App';
import './index.css';
import { applyAccessibilityPreferences, DEFAULT_ACCESSIBILITY } from './utils/accessibility';

applyAccessibilityPreferences(DEFAULT_ACCESSIBILITY);

window.addEventListener('mousemove', (event) => {
  document.documentElement.style.setProperty('--reading-guide-y', `${event.clientY}px`);
});

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <AuthProvider>
        <App />
        <Toaster
          position="top-right"
          toastOptions={{
            style: {
              background: '#1a1a1a',
              color: '#e0e0e0',
              border: '1px solid rgba(212,175,55,0.15)',
              borderRadius: '12px',
              fontSize: '14px',
            },
            success: { iconTheme: { primary: '#d4af37', secondary: '#0a0a0a' } },
            error: { iconTheme: { primary: '#ef4444', secondary: '#0a0a0a' } },
          }}
        />
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);
