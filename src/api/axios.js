import axios from 'axios';

const getBaseUrl = () => {
    // Jika sedang development (npm run dev)
    if (import.meta.env.DEV) {
        if (import.meta.env.VITE_API_URL) return import.meta.env.VITE_API_URL;
        return 'http://localhost:6990';
    }
    // Jika production (hasil build), SELALU ikuti IP address di browser
    return window.location.origin;
};

const API_BASE_URL = `${getBaseUrl()}/api`;
const api = axios.create({
    baseURL: API_BASE_URL,
    withCredentials: true,
    headers: {
        'Content-Type': 'application/json',
    }
});

api.interceptors.response.use(
  (response) => {
    if (response.data && Object.prototype.hasOwnProperty.call(response.data, 'data')) {
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