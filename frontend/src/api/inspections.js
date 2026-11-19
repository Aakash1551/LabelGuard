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

export const uploadPackagingImages = async (formData, onUploadProgress) => {
  const response = await api.post('/inspections/upload', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
    onUploadProgress,
    timeout: 120000, // 2 minutes for multi-image processing with OCR
  });
  return response.data;
};

export const triggerExtraction = async (id) => {
  const response = await api.post(`/inspections/${id}/extract`);
  return response.data;
};

export const getInspectionDeclarations = async (id) => {
  const response = await api.get(`/inspections/${id}/declarations`);
  return response.data;
};

export const evaluateInspection = async (id) => {
  const response = await api.post(`/inspections/${id}/evaluate`);
  return response.data;
};

export const getComplianceSummary = async (id) => {
  const response = await api.get(`/inspections/${id}/compliance`);
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
