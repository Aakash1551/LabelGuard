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
    timeout: 120000,
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

// --- Step 7.4: Report Generation & Export APIs ---

export const generateReport = async (id) => {
  const response = await api.post(`/inspections/${id}/report`);
  return response.data;
};

export const verifyReportSha256 = async (id) => {
  const response = await api.post(`/inspections/${id}/report/verify`);
  return response.data;
};

export const downloadReportPdf = async (id, customFilename = null) => {
  const response = await api.get(`/inspections/${id}/report/download`, {
    responseType: 'blob',
  });
  const url = window.URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }));
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', customFilename || `inspection_${id}_report.pdf`);
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
  return true;
};

export const downloadDossierJson = async (id, customFilename = null) => {
  const response = await api.get(`/inspections/${id}/export/json`);
  const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(response.data, null, 2));
  const link = document.createElement('a');
  link.href = dataStr;
  link.setAttribute('download', customFilename || `inspection_${id}_dossier.json`);
  document.body.appendChild(link);
  link.click();
  link.remove();
  return true;
};

export const downloadDossierCsv = async (id, customFilename = null) => {
  const response = await api.get(`/inspections/${id}/export/csv`, {
    responseType: 'blob',
  });
  const url = window.URL.createObjectURL(new Blob([response.data], { type: 'text/csv' }));
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', customFilename || `inspection_${id}_findings.csv`);
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
  return true;
};
