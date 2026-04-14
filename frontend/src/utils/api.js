import axios from "axios";

const api = axios.create({
  baseURL: process.env.REACT_APP_API_URL || "/api",
});

// --- Existing endpoints ---
export const searchTargets = (q) => api.get("/targets/search", { params: { q } });
export const getTarget = (id) => api.get(`/targets/${id}`);
export const getAntibodies = (targetId, params) =>
  api.get(`/targets/${targetId}/antibodies`, { params });
export const getAntibodyDetail = (id) => api.get(`/antibodies/${id}`);
export const getHeatmap = (targetId) => api.get(`/targets/${targetId}/heatmap`);
export const getTargetStats = (targetId) => api.get(`/targets/${targetId}/stats`);
export const getApplicationTypes = () => api.get("/applications");

// --- Living Cell visualization ---
export const getCellMap = () => api.get("/cell-map");

// --- Autocomplete ---
export const autocompleteTargets = (q) =>
  api.get("/targets/autocomplete", { params: { q } });

// --- Popular targets ---
export const getPopularTargets = () => api.get("/targets/popular");

// --- Compare ---
export const compareAntibodies = (ids) =>
  api.get("/antibodies/compare", { params: { ids: ids.join(",") } });

// --- Export ---
export const getExportUrl = (targetId, filters = {}) => {
  const base = api.defaults.baseURL;
  const params = new URLSearchParams();
  if (filters.application) params.set("application", filters.application);
  if (filters.species) params.set("species", filters.species);
  return `${base}/targets/${targetId}/antibodies/export?${params.toString()}`;
};

export const getCompareExportUrl = (ids) => {
  const base = api.defaults.baseURL;
  return `${base}/antibodies/compare/export?ids=${ids.join(",")}`;
};

export default api;