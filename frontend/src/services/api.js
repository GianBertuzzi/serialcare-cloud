import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:3000/api"
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

export function getEvidenciasOrden(idOrden) {
  return api.get(`/ordenes/${idOrden}/evidencias`);
}

export function createEvidenciaManual(idOrden, data) {
  return api.post(`/ordenes/${idOrden}/evidencias`, data);
}

export function uploadEvidenciaOrden(idOrden, formData) {
  return api.post(`/ordenes/${idOrden}/evidencias`, formData);
}

export default api;
