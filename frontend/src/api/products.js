import api from './client';

export const listProducts = async (params = {}) => {
  const response = await api.get('/products', { params });
  return response.data;
};

export const createProduct = async (productData) => {
  const response = await api.post('/products', productData);
  return response.data;
};

export const getProduct = async (id) => {
  const response = await api.get(`/products/${id}`);
  return response.data;
};
