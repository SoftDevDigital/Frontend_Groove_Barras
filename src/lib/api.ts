import axios from "axios";
import { getToken, logout } from "./auth";

export const api = axios.create({
  baseURL: "https://api.festgogest.com",
  headers: { "Content-Type": "application/json" },
});

// Agrega Authorization si hay token
api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Manejo básico de expiración (401)
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err?.response?.status === 401) {
      logout();
      // opcional: redirigir a /login si estás en cliente
      if (typeof window !== "undefined") window.location.href = "/login";
    }
    return Promise.reject(err);
  }
);
