import axios from 'axios';

const API_BASE_URL = import.meta.env.DEV 
    ? `${import.meta.env.VITE_API_URL || 'http://localhost:6990'}/api` 
    : `${window.location.origin}/api`;

const api = axios.create({
    baseURL: API_BASE_URL,
    withCredentials: true,
    headers: {
        'Content-Type': 'application/json',
    }
});

api.interceptors.response.use(
  (response) => {
    if (response.data && response.data.hasOwnProperty('data')) {
        response.data = response.data.data;
    }
    return response;
  },
  (error) => {
    if (error.response && error.response.status === 403) {
      window.dispatchEvent(new Event("licenseExpired"));
    }
    return Promise.reject(error);
  }
);

axios.defaults.withCredentials = true;

export default api;