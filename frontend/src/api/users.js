import api from './client';

export const listUsers = async (params = {}) => {
  const response = await api.get('/users', { params });
  return response.data;
};

export const updateUser = async (id, userData) => {
  const response = await api.put(`/users/${id}`, userData);
  return response.data;
};
