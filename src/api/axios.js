import axios from 'axios';

const API_BASE_URL = 'http://localhost:6990/api';

const api = axios.create({
    baseURL: API_BASE_URL,
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

export default api;