import React, { useState, useEffect, useMemo } from 'react';
import { listProducts, createProduct } from '../api/products';
import {
  Package,
  Plus,
  Search,
  Filter,
  RefreshCw,
  X,
  AlertCircle,
  Barcode,
  CheckCircle2,
} from 'lucide-react';

export const Products = () => {
  const [products, setProducts] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formName, setFormName] = useState('');
  const [formBrand, setFormBrand] = useState('');
  const [formCategory, setFormCategory] = useState('FOOD');
  const [formGtin, setFormGtin] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState('');

  const categories = [
    'FOOD',
    'COSMETICS',
    'BEVERAGES',
    'ELECTRONICS',
    'PERSONAL_CARE',
    'COMMODITY',
    'OTHER',
  ];

  const fetchProducts = async () => {
    setIsLoading(true);
    setError('');
    try {
      const params = {};
      if (categoryFilter !== 'ALL') {
        params.category = categoryFilter;
      }
      if (searchQuery.trim()) {
        params.search = searchQuery.trim();
      }
      const data = await listProducts(params);
      setProducts(data || []);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to retrieve products catalog.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, [categoryFilter]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchProducts();
  };

  const handleCreateProduct = async (e) => {
    e.preventDefault();
    setFormError('');
    setFormSuccess('');

    if (!formName.trim()) {
      setFormError('Product name is required.');
      return;
    }

    setIsSubmitting(true);
    try {
      await createProduct({
        name: formName.trim(),
        brand: formBrand.trim() || null,
        category: formCategory,
        barcode_gtin: formGtin.trim() || null,
      });

      setFormSuccess(`Product '${formName}' created successfully.`);
      setFormName('');
      setFormBrand('');
      setFormGtin('');
      fetchProducts();

      setTimeout(() => {
        setIsModalOpen(false);
        setFormSuccess('');
      }, 1200);
    } catch (err) {
      setFormError(err.response?.data?.detail || 'Failed to register product.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Product Catalog</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Registered packaged commodities indexed by Barcode / GTIN for compliance tracking.
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <button
            onClick={fetchProducts}
            disabled={isLoading}
            className="inline-flex items-center space-x-1.5 px-3 py-2 border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 disabled:opacity-50 transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
          <button
            onClick={() => setIsModalOpen(true)}
            className="inline-flex items-center space-x-1.5 px-3.5 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-xs font-semibold shadow-xs transition cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add Product</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm flex items-center justify-between">
          <span>{error}</span>
          <button onClick={fetchProducts} className="underline text-xs font-bold ml-4">
            Retry
          </button>
        </div>
      )}

      {/* Toolbar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
        <form onSubmit={handleSearchSubmit} className="relative w-full sm:w-80">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
            <Search className="w-4 h-4" />
          </div>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by name or brand..."
            className="block w-full pl-9 pr-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none"
          />
        </form>

        <div className="flex items-center space-x-2 w-full sm:w-auto overflow-x-auto">
          <span className="text-xs text-slate-400 flex items-center space-x-1">
            <Filter className="w-3.5 h-3.5" />
            <span>Category:</span>
          </span>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-medium text-slate-700 outline-none cursor-pointer"
          >
            <option value="ALL">All Categories</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Product Grid */}
      {isLoading ? (
        <div className="p-16 text-center text-slate-400 text-sm">
          <div className="w-8 h-8 border-3 border-brand-500 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
          Loading product catalog...
        </div>
      ) : products.length === 0 ? (
        <div className="bg-white p-16 rounded-xl border border-slate-200 text-center">
          <Package className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-base font-bold text-slate-800">No Products Registered</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
            Register products to enable automated Barcode / GTIN cross-referencing during label inspections.
          </p>
          <button
            onClick={() => setIsModalOpen(true)}
            className="mt-4 inline-flex items-center space-x-1.5 px-3.5 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-xs font-semibold shadow-xs"
          >
            <Plus className="w-4 h-4" />
            <span>Register First Product</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {products.map((p) => (
            <div
              key={p.id}
              className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-xs hover:border-slate-300 transition flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-brand-700 bg-brand-50 border border-brand-200 rounded px-2 py-0.5">
                    {p.category}
                  </span>
                  {p.barcode_gtin && (
                    <span className="text-[11px] font-mono text-slate-500 flex items-center space-x-1">
                      <Barcode className="w-3.5 h-3.5" />
                      <span>{p.barcode_gtin}</span>
                    </span>
                  )}
                </div>
                <h3 className="text-sm font-bold text-slate-900 mt-2.5 leading-snug">{p.name}</h3>
                {p.brand && (
                  <p className="text-xs font-medium text-slate-500 mt-0.5">Brand: {p.brand}</p>
                )}
              </div>

              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
                <span>ID: {p.id.slice(-6)}</span>
                <span>{p.created_at ? new Date(p.created_at).toLocaleDateString() : '—'}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Product Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full border border-slate-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900">Register New Commodity</h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateProduct} className="p-6 space-y-4">
              {formError && (
                <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center space-x-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              {formSuccess && (
                <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs flex items-center space-x-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>{formSuccess}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Product Name *
                </label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g. Pure Basmati Rice 1kg"
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Brand Name
                </label>
                <input
                  type="text"
                  value={formBrand}
                  onChange={(e) => setFormBrand(e.target.value)}
                  placeholder="e.g. Royal Harvest"
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Category *
                  </label>
                  <select
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value)}
                    className="w-full px-2.5 py-2 text-xs border border-slate-300 rounded-lg bg-white outline-none cursor-pointer"
                  >
                    {categories.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Barcode / GTIN
                  </label>
                  <input
                    type="text"
                    value={formGtin}
                    onChange={(e) => setFormGtin(e.target.value)}
                    placeholder="8901234567890"
                    className="w-full px-3 py-2 text-xs font-mono border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 outline-none"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-3 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-xs font-semibold shadow-xs disabled:opacity-50"
                >
                  {isSubmitting ? 'Saving...' : 'Save Product'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
