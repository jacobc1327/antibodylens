import axios from "axios";

const api = axios.create({
  baseURL: process.env.REACT_APP_API_URL || "/api",
});

export const searchTargets = (q) => api.get("/targets/search", { params: { q } });
export const getTarget = (id) => api.get(`/targets/${id}`);
export const getAntibodies = (targetId, params) =>
  api.get(`/targets/${targetId}/antibodies`, { params });
export const getAntibodyDetail = (id) => api.get(`/antibodies/${id}`);
export const getHeatmap = (targetId) => api.get(`/targets/${targetId}/heatmap`);
export const getTargetStats = (targetId) => api.get(`/targets/${targetId}/stats`);
export const getApplicationTypes = () => api.get("/applications");

export default api;
