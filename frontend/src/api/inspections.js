import api from './client';

export const getInspectionStats = async () => {
  const response = await api.get('/inspections/stats');
  return response.data;
};

export const listInspections = async (params = {}) => {
  const response = await api.get('/inspections', { params });
  return response.data;
};

export const getInspection = async (id) => {
  const response = await api.get(`/inspections/${id}`);
  return response.data;
};

export const evaluateInspection = async (id) => {
  const response = await api.post(`/inspections/${id}/evaluate`);
  return response.data;
};

export const getInspectionFindings = async (id) => {
  const response = await api.get(`/inspections/${id}/findings`);
  return response.data;
};

export const overrideInspectionCompliance = async (id, overrideStatus, reason) => {
  const response = await api.put(`/inspections/${id}/override`, {
    override_status: overrideStatus,
    reason,
  });
  return response.data;
};
