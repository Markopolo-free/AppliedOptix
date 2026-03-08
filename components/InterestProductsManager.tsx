import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { push, ref, remove, set, update } from 'firebase/database';
import { db } from '../services/firebase';
import {
  InterestProduct,
  InterestProductType,
  DayCountConvention,
  AccrualFrequency,
  PayoutFrequency,
  CompoundingType,
  InterestApprovalState,
} from '../types';
import { ApprovalStatus, UserRole } from '../enums';
import { useAuth } from '../contexts/AuthContext';
import { logAudit, calculateChanges } from '../services/auditService';
import { queryInterestProductsByTenant } from '../services/multiTenantService';

const initialFormState = {
  productCode: '',
  name: '',
  productType: 'SAVINGS' as InterestProductType,
  currency: 'EUR',
  dayCountConvention: 'ACT/365F' as DayCountConvention,
  accrualFrequency: 'DAILY' as AccrualFrequency,
  payoutFrequency: 'MONTHLY' as PayoutFrequency,
  compounding: 'NONE' as CompoundingType,
  roundingScale: '6',
  roundingMode: 'HALF_UP',
  minimumBalance: '0',
  allowNegativeRates: false,
};

const InterestProductsManager: React.FC = () => {
  const { currentUser, effectiveTenantId } = useAuth();

  const [products, setProducts] = useState<InterestProduct[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [formData, setFormData] = useState(initialFormState);
  const [editingProduct, setEditingProduct] = useState<InterestProduct | null>(null);
  const [errorMessage, setErrorMessage] = useState('');

  const searchInputRef = useRef<HTMLInputElement>(null);

  const isMaker = currentUser?.role === UserRole.Maker || currentUser?.role === UserRole.Administrator;
  const isChecker = currentUser?.role === UserRole.Checker || currentUser?.role === UserRole.Administrator;

  const fetchProducts = useCallback(async () => {
    setIsLoading(true);
    try {
      const list = await queryInterestProductsByTenant(effectiveTenantId);
      list.sort((a: InterestProduct, b: InterestProduct) => {
        const aTime = new Date(a.lastModifiedAt || '').getTime();
        const bTime = new Date(b.lastModifiedAt || '').getTime();
        return bTime - aTime;
      });
      setProducts(list as InterestProduct[]);
    } catch (error) {
      console.error('Failed to load interest products:', error);
      setProducts([]);
    } finally {
      setIsLoading(false);
    }
  }, [effectiveTenantId]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  const filteredProducts = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return products;
    return products.filter((product) => {
      return (
        product.productCode.toLowerCase().includes(term) ||
        product.name.toLowerCase().includes(term) ||
        product.productType.toLowerCase().includes(term) ||
        product.status.toLowerCase().includes(term)
      );
    });
  }, [products, searchTerm]);

  const resetForm = () => {
    setEditingProduct(null);
    setFormData(initialFormState);
    setErrorMessage('');
  };

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type, checked } = event.target as HTMLInputElement;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const validateForm = (): boolean => {
    if (!formData.productCode.trim()) {
      setErrorMessage('Product code is required.');
      return false;
    }
    if (!formData.name.trim()) {
      setErrorMessage('Product name is required.');
      return false;
    }
    const roundingScale = Number(formData.roundingScale);
    if (!Number.isFinite(roundingScale) || roundingScale < 0 || roundingScale > 12) {
      setErrorMessage('Rounding scale must be between 0 and 12.');
      return false;
    }
    const minimumBalance = Number(formData.minimumBalance || 0);
    if (!Number.isFinite(minimumBalance)) {
      setErrorMessage('Minimum balance must be a valid number.');
      return false;
    }

    const duplicate = products.find((p) => {
      if (editingProduct && p.id === editingProduct.id) return false;
      return p.productCode.toLowerCase() === formData.productCode.trim().toLowerCase();
    });

    if (duplicate) {
      setErrorMessage('Product code must be unique within tenant.');
      return false;
    }

    setErrorMessage('');
    return true;
  };

  const buildProductPayload = (status: InterestApprovalState): Omit<InterestProduct, 'id'> => {
    const nowIso = new Date().toISOString();
    const basePayload: Omit<InterestProduct, 'id'> = {
      productCode: formData.productCode.trim().toUpperCase(),
      name: formData.name.trim(),
      productType: formData.productType,
      currency: formData.currency.trim().toUpperCase(),
      dayCountConvention: formData.dayCountConvention,
      accrualFrequency: formData.accrualFrequency,
      payoutFrequency: formData.payoutFrequency,
      compounding: formData.compounding,
      roundingScale: Number(formData.roundingScale),
      roundingMode: formData.roundingMode.trim() || 'HALF_UP',
      minimumBalance: Number(formData.minimumBalance || 0),
      allowNegativeRates: !!formData.allowNegativeRates,
      status,
      tenantId: effectiveTenantId,
      makerName: editingProduct?.makerName || currentUser?.name || 'Unknown User',
      makerEmail: editingProduct?.makerEmail || currentUser?.email || '',
      makerTimestamp: editingProduct?.makerTimestamp || nowIso,
      checkerName: editingProduct?.checkerName,
      checkerEmail: editingProduct?.checkerEmail,
      checkerTimestamp: editingProduct?.checkerTimestamp,
      lastModifiedBy: currentUser?.email || 'usr_admin',
      lastModifiedAt: nowIso,
    };

    return basePayload;
  };

  const saveProduct = async (targetStatus: InterestApprovalState) => {
    if (!isMaker || !currentUser) {
      alert('Only Maker or Administrator can save products.');
      return;
    }
    if (!validateForm()) return;

    setIsSaving(true);
    try {
      const payload = buildProductPayload(targetStatus);
      const entityName = `${payload.productCode} - ${payload.name}`;

      if (editingProduct) {
        const productRef = ref(db, `banking/interestProducts/${editingProduct.id}`);
        await update(productRef, payload);

        const changes = calculateChanges(editingProduct as Record<string, any>, payload as Record<string, any>);
        await logAudit({
          userId: currentUser.email,
          userName: currentUser.name,
          userEmail: currentUser.email,
          action: 'update',
          entityType: 'reference',
          entityId: editingProduct.id,
          entityName,
          changes,
          metadata: {
            tenantId: effectiveTenantId,
            domain: 'banking-interest-mvp',
            status: targetStatus,
          },
        });
      } else {
        const productsRef = ref(db, 'banking/interestProducts');
        const newProductRef = push(productsRef);
        await set(newProductRef, payload);

        await logAudit({
          userId: currentUser.email,
          userName: currentUser.name,
          userEmail: currentUser.email,
          action: 'create',
          entityType: 'reference',
          entityId: newProductRef.key || undefined,
          entityName,
          metadata: {
            tenantId: effectiveTenantId,
            domain: 'banking-interest-mvp',
            status: targetStatus,
          },
        });
      }

      await fetchProducts();
      resetForm();
    } catch (error) {
      console.error('Failed saving interest product:', error);
      alert('Failed saving interest product. Please retry.');
    } finally {
      setIsSaving(false);
    }
  };

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (!event.altKey) return;

      if (event.key.toLowerCase() === 'n') {
        event.preventDefault();
        setEditingProduct(null);
        setFormData(initialFormState);
        setErrorMessage('');
        return;
      }

      if (event.key.toLowerCase() === 'f') {
        event.preventDefault();
        searchInputRef.current?.focus();
        return;
      }

      if (event.key.toLowerCase() === 's') {
        event.preventDefault();
        if (isMaker) {
          void saveProduct('Draft');
        }
        return;
      }

      if (event.key.toLowerCase() === 'p') {
        event.preventDefault();
        if (isMaker) {
          void saveProduct(ApprovalStatus.Pending);
        }
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isMaker, formData, saveProduct]);

  const handleEdit = (product: InterestProduct) => {
    setEditingProduct(product);
    setFormData({
      productCode: product.productCode,
      name: product.name,
      productType: product.productType,
      currency: product.currency,
      dayCountConvention: product.dayCountConvention,
      accrualFrequency: product.accrualFrequency,
      payoutFrequency: product.payoutFrequency,
      compounding: product.compounding,
      roundingScale: String(product.roundingScale),
      roundingMode: product.roundingMode,
      minimumBalance: String(product.minimumBalance ?? 0),
      allowNegativeRates: product.allowNegativeRates,
    });
    setErrorMessage('');
  };

  const handleDelete = async (product: InterestProduct) => {
    if (!isMaker || !currentUser) {
      alert('Only Maker or Administrator can delete draft products.');
      return;
    }
    if (product.status !== 'Draft') {
      alert('Only Draft products can be deleted.');
      return;
    }
    const confirmed = window.confirm(`Delete draft product ${product.productCode}?`);
    if (!confirmed) return;

    try {
      await remove(ref(db, `banking/interestProducts/${product.id}`));
      await logAudit({
        userId: currentUser.email,
        userName: currentUser.name,
        userEmail: currentUser.email,
        action: 'delete',
        entityType: 'reference',
        entityId: product.id,
        entityName: `${product.productCode} - ${product.name}`,
        metadata: {
          tenantId: effectiveTenantId,
          domain: 'banking-interest-mvp',
          status: product.status,
        },
      });
      await fetchProducts();
      if (editingProduct?.id === product.id) {
        resetForm();
      }
    } catch (error) {
      console.error('Failed deleting product:', error);
      alert('Failed deleting product.');
    }
  };

  const updateApproval = async (product: InterestProduct, nextStatus: ApprovalStatus.Approved | ApprovalStatus.Rejected) => {
    if (!isChecker || !currentUser) {
      alert('Only Checker or Administrator can approve/reject.');
      return;
    }
    if (product.status !== ApprovalStatus.Pending) {
      alert('Only Pending items can be approved or rejected.');
      return;
    }

    const payload: Partial<InterestProduct> = {
      status: nextStatus,
      checkerName: currentUser.name,
      checkerEmail: currentUser.email,
      checkerTimestamp: new Date().toISOString(),
      lastModifiedBy: currentUser.email,
      lastModifiedAt: new Date().toISOString(),
    };

    try {
      await update(ref(db, `banking/interestProducts/${product.id}`), payload);
      await logAudit({
        userId: currentUser.email,
        userName: currentUser.name,
        userEmail: currentUser.email,
        action: nextStatus === ApprovalStatus.Approved ? 'approve' : 'reject',
        entityType: 'reference',
        entityId: product.id,
        entityName: `${product.productCode} - ${product.name}`,
        changes: [
          { field: 'status', oldValue: product.status, newValue: nextStatus },
        ],
        metadata: {
          tenantId: effectiveTenantId,
          domain: 'banking-interest-mvp',
        },
      });
      await fetchProducts();
    } catch (error) {
      console.error('Failed updating approval status:', error);
      alert('Failed approval update.');
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-6">
        <h1 className="text-3xl font-bold text-gray-800 mb-2">Interest Products Manager</h1>
        <p className="text-gray-600">
          Tenant-safe setup of banking interest products with maker/checker workflow and complete audit trails.
        </p>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Search (Alt+F)</label>
            <input
              ref={searchInputRef}
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2"
              placeholder="Code, name, type, status"
            />
          </div>
          <div className="flex items-end gap-2">
            <button
              type="button"
              onClick={resetForm}
              className="px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-800"
            >
              New Draft (Alt+N)
            </button>
            <button
              type="button"
              onClick={fetchProducts}
              className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
            >
              Refresh
            </button>
          </div>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-6">
        <h2 className="text-xl font-semibold text-gray-800 mb-4">Product Setup</h2>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void saveProduct('Draft');
          }}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
        >
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Product Code</label>
            <input name="productCode" value={formData.productCode} onChange={handleInputChange} className="w-full border border-gray-300 rounded-lg px-3 py-2" maxLength={20} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Product Name</label>
            <input name="name" value={formData.name} onChange={handleInputChange} className="w-full border border-gray-300 rounded-lg px-3 py-2" maxLength={80} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Product Type</label>
            <select name="productType" value={formData.productType} onChange={handleInputChange} className="w-full border border-gray-300 rounded-lg px-3 py-2">
              <option value="SAVINGS">SAVINGS</option>
              <option value="TERM_DEPOSIT">TERM_DEPOSIT</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Currency</label>
            <input name="currency" value={formData.currency} onChange={handleInputChange} className="w-full border border-gray-300 rounded-lg px-3 py-2" maxLength={3} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Day Count</label>
            <select name="dayCountConvention" value={formData.dayCountConvention} onChange={handleInputChange} className="w-full border border-gray-300 rounded-lg px-3 py-2">
              <option value="ACT/365F">ACT/365F</option>
              <option value="ACT/360">ACT/360</option>
              <option value="30E/360">30E/360</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Accrual Frequency</label>
            <select name="accrualFrequency" value={formData.accrualFrequency} onChange={handleInputChange} className="w-full border border-gray-300 rounded-lg px-3 py-2">
              <option value="DAILY">DAILY</option>
              <option value="MONTHLY">MONTHLY</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Payout Frequency</label>
            <select name="payoutFrequency" value={formData.payoutFrequency} onChange={handleInputChange} className="w-full border border-gray-300 rounded-lg px-3 py-2">
              <option value="MONTHLY">MONTHLY</option>
              <option value="QUARTERLY">QUARTERLY</option>
              <option value="AT_MATURITY">AT_MATURITY</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Compounding</label>
            <select name="compounding" value={formData.compounding} onChange={handleInputChange} className="w-full border border-gray-300 rounded-lg px-3 py-2">
              <option value="NONE">NONE</option>
              <option value="DAILY">DAILY</option>
              <option value="MONTHLY">MONTHLY</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Rounding Scale</label>
            <input type="number" name="roundingScale" value={formData.roundingScale} onChange={handleInputChange} className="w-full border border-gray-300 rounded-lg px-3 py-2" min={0} max={12} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Rounding Mode</label>
            <input name="roundingMode" value={formData.roundingMode} onChange={handleInputChange} className="w-full border border-gray-300 rounded-lg px-3 py-2" maxLength={20} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Minimum Balance</label>
            <input type="number" step="0.01" name="minimumBalance" value={formData.minimumBalance} onChange={handleInputChange} className="w-full border border-gray-300 rounded-lg px-3 py-2" />
          </div>
          <div className="flex items-center gap-2 mt-7">
            <input type="checkbox" name="allowNegativeRates" checked={formData.allowNegativeRates} onChange={handleInputChange} />
            <label className="text-sm font-medium text-gray-700">Allow negative rates</label>
          </div>

          <div className="md:col-span-2 lg:col-span-3 flex flex-wrap gap-2 pt-2">
            <button type="submit" disabled={!isMaker || isSaving} className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50">
              {editingProduct ? 'Update Draft' : 'Save Draft'} (Alt+S)
            </button>
            <button
              type="button"
              disabled={!isMaker || isSaving}
              onClick={() => void saveProduct(ApprovalStatus.Pending)}
              className="px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:opacity-50"
            >
              Submit for Approval (Alt+P)
            </button>
            <button type="button" onClick={resetForm} className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300">
              Clear
            </button>
          </div>
        </form>
        {errorMessage && <p className="text-sm text-red-600 mt-3">{errorMessage}</p>}
      </div>

      <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-6">
        <h2 className="text-xl font-semibold text-gray-800 mb-4">Products ({filteredProducts.length})</h2>

        {isLoading ? (
          <p className="text-gray-600">Loading products...</p>
        ) : filteredProducts.length === 0 ? (
          <p className="text-gray-600">No interest products found for this tenant.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full border border-gray-200 rounded-lg overflow-hidden text-sm">
              <thead className="bg-gray-100 text-gray-700">
                <tr>
                  <th className="px-3 py-2 text-left">Code</th>
                  <th className="px-3 py-2 text-left">Name</th>
                  <th className="px-3 py-2 text-left">Type</th>
                  <th className="px-3 py-2 text-left">Currency</th>
                  <th className="px-3 py-2 text-left">Day Count</th>
                  <th className="px-3 py-2 text-left">Status</th>
                  <th className="px-3 py-2 text-left">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredProducts.map((product) => (
                  <tr key={product.id} className="border-t border-gray-200">
                    <td className="px-3 py-2 font-semibold">{product.productCode}</td>
                    <td className="px-3 py-2">{product.name}</td>
                    <td className="px-3 py-2">{product.productType}</td>
                    <td className="px-3 py-2">{product.currency}</td>
                    <td className="px-3 py-2">{product.dayCountConvention}</td>
                    <td className="px-3 py-2">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        product.status === 'Approved'
                          ? 'bg-green-100 text-green-800'
                          : product.status === 'Rejected'
                          ? 'bg-red-100 text-red-800'
                          : product.status === 'Pending'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-gray-100 text-gray-700'
                      }`}>
                        {product.status}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap gap-2">
                        <button onClick={() => handleEdit(product)} className="px-2 py-1 bg-blue-600 text-white rounded hover:bg-blue-700">Edit</button>
                        <button
                          onClick={() => void updateApproval(product, ApprovalStatus.Approved)}
                          disabled={!isChecker || product.status !== ApprovalStatus.Pending}
                          className="px-2 py-1 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-40"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => void updateApproval(product, ApprovalStatus.Rejected)}
                          disabled={!isChecker || product.status !== ApprovalStatus.Pending}
                          className="px-2 py-1 bg-orange-600 text-white rounded hover:bg-orange-700 disabled:opacity-40"
                        >
                          Reject
                        </button>
                        <button
                          onClick={() => void handleDelete(product)}
                          disabled={!isMaker || product.status !== 'Draft'}
                          className="px-2 py-1 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-40"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default InterestProductsManager;
