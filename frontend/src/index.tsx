import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { Provider } from 'react-redux';
import { ThemeProvider } from '@mui/material/styles';
import { CssBaseline } from '@mui/material';
import { SnackbarProvider } from 'notistack';
import axios from 'axios';
import { store } from './store/store';
import { theme } from './theme/theme';
import App from './App';
import './index.css';

// Ensure all cross-origin requests send and receive cookies (for SSO auto-login)
axios.defaults.withCredentials = true;

// Global request interceptor to automatically add Authorization token
axios.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('sso_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Global response interceptor to handle 401 Unauthorized (e.g. revoked session)
axios.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      localStorage.removeItem('sso_token');
      localStorage.removeItem('sso_user');
      // Redirect to login only if not already on the login page to avoid loops
      if (!window.location.pathname.startsWith('/sso/login')) {
        window.location.href = '/sso/login';
      }
    }
    return Promise.reject(error);
  }
);

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);

root.render(
  <React.StrictMode>
    <Provider store={store}>
      <BrowserRouter basename="/sso">
        <ThemeProvider theme={theme}>
          <CssBaseline />
          <SnackbarProvider 
            maxSnack={3}
            anchorOrigin={{
              vertical: 'top',
              horizontal: 'right',
            }}
            autoHideDuration={5000}
          >
            <App />
          </SnackbarProvider>
        </ThemeProvider>
      </BrowserRouter>
    </Provider>
  </React.StrictMode>
);