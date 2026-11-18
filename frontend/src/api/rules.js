import api from './client';

export const listRules = async (params = {}) => {
  const response = await api.get('/rules', { params });
  return response.data;
};

export const getRuleByCode = async (code) => {
  const response = await api.get(`/rules/${code}`);
  return response.data;
};
