import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { get, push, ref, remove, set, update } from 'firebase/database';
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

type InterestReferenceOptionSet = {
  productTypes: string[];
  currencies: string[];
  dayCountConventions: string[];
  accrualFrequencies: string[];
  payoutFrequencies: string[];
  compoundingTypes: string[];
  roundingScales: string[];
  roundingModes: string[];
};

const INTEREST_REFERENCE_DEFAULTS: InterestReferenceOptionSet = {
  productTypes: [],
  currencies: [],
  dayCountConventions: [],
  accrualFrequencies: [],
  payoutFrequencies: [],
  compoundingTypes: [],
  roundingScales: [],
  roundingModes: [],
};

const INTEREST_REFERENCE_PATHS: Record<keyof InterestReferenceOptionSet, string> = {
  productTypes: 'referenceInterestProductTypes',
  currencies: 'referenceInterestCurrencies',
  dayCountConventions: 'referenceInterestDayCountConventions',
  accrualFrequencies: 'referenceInterestAccrualFrequencies',
  payoutFrequencies: 'referenceInterestPayoutFrequencies',
  compoundingTypes: 'referenceInterestCompoundingTypes',
  roundingScales: 'referenceInterestRoundingScales',
  roundingModes: 'referenceInterestRoundingModes',
};

const toNormalizedOptions = (snapshotValue: any, fallback: string[]): string[] => {
  const source = snapshotValue || {};
  const values = Object.values(source)
    .map((entry: any) => {
      if (typeof entry === 'string') return entry.trim();
      if (entry && typeof entry.name === 'string') return entry.name.trim();
      if (entry && typeof entry.code === 'string') return entry.code.trim();
      return '';
    })
    .filter(Boolean);

  const uniqueSorted = Array.from(new Set(values));
  if (uniqueSorted.length === 0) return fallback;
  return uniqueSorted.sort((a, b) => a.localeCompare(b));
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
  const [referenceOptions, setReferenceOptions] = useState<InterestReferenceOptionSet>(INTEREST_REFERENCE_DEFAULTS);
  const [isLoadingReferenceData, setIsLoadingReferenceData] = useState(true);

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

  const fetchReferenceOptions = useCallback(async () => {
    setIsLoadingReferenceData(true);
    try {
      const entries = await Promise.all(
        (Object.keys(INTEREST_REFERENCE_PATHS) as Array<keyof InterestReferenceOptionSet>).map(async (key) => {
          const snapshot = await get(ref(db, INTEREST_REFERENCE_PATHS[key]));
          return [key, toNormalizedOptions(snapshot.val(), INTEREST_REFERENCE_DEFAULTS[key])] as const;
        })
      );

      const loaded = entries.reduce((acc, [key, values]) => {
        acc[key] = values;
        return acc;
      }, { ...INTEREST_REFERENCE_DEFAULTS } as InterestReferenceOptionSet);

      setReferenceOptions(loaded);
      setFormData((prev) => ({
        ...prev,
        productType: loaded.productTypes.includes(prev.productType) ? prev.productType : loaded.productTypes[0],
        currency: loaded.currencies.includes(prev.currency) ? prev.currency : loaded.currencies[0],
        dayCountConvention: loaded.dayCountConventions.includes(prev.dayCountConvention) ? prev.dayCountConvention : loaded.dayCountConventions[0],
        accrualFrequency: loaded.accrualFrequencies.includes(prev.accrualFrequency) ? prev.accrualFrequency : loaded.accrualFrequencies[0],
        payoutFrequency: loaded.payoutFrequencies.includes(prev.payoutFrequency) ? prev.payoutFrequency : loaded.payoutFrequencies[0],
        compounding: loaded.compoundingTypes.includes(prev.compounding) ? prev.compounding : loaded.compoundingTypes[0],
        roundingScale: loaded.roundingScales.includes(prev.roundingScale) ? prev.roundingScale : loaded.roundingScales[0],
        roundingMode: loaded.roundingModes.includes(prev.roundingMode) ? prev.roundingMode : loaded.roundingModes[0],
      }));
    } catch (error) {
      console.error('Failed to load interest reference options:', error);
    } finally {
      setIsLoadingReferenceData(false);
    }
  }, []);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  useEffect(() => {
    fetchReferenceOptions();
  }, [fetchReferenceOptions]);

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
    setFormData({
      ...initialFormState,
      productType: referenceOptions.productTypes[0] || initialFormState.productType,
      currency: referenceOptions.currencies[0] || initialFormState.currency,
      dayCountConvention: referenceOptions.dayCountConventions[0] || initialFormState.dayCountConvention,
      accrualFrequency: referenceOptions.accrualFrequencies[0] || initialFormState.accrualFrequency,
      payoutFrequency: referenceOptions.payoutFrequencies[0] || initialFormState.payoutFrequency,
      compounding: referenceOptions.compoundingTypes[0] || initialFormState.compounding,
      roundingScale: referenceOptions.roundingScales[0] || initialFormState.roundingScale,
      roundingMode: referenceOptions.roundingModes[0] || initialFormState.roundingMode,
    });
    setErrorMessage('');
  };

  const missingReferenceFields = useMemo(() => {
    const checks: Array<{ label: string; values: string[] }> = [
      { label: 'Product Type', values: referenceOptions.productTypes },
      { label: 'Currency', values: referenceOptions.currencies },
      { label: 'Day Count', values: referenceOptions.dayCountConventions },
      { label: 'Accrual Frequency', values: referenceOptions.accrualFrequencies },
      { label: 'Payout Frequency', values: referenceOptions.payoutFrequencies },
      { label: 'Compounding', values: referenceOptions.compoundingTypes },
      { label: 'Rounding Scale', values: referenceOptions.roundingScales },
      { label: 'Rounding Mode', values: referenceOptions.roundingModes },
    ];

    return checks.filter((c) => c.values.length === 0).map((c) => c.label);
  }, [referenceOptions]);

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

    if (!referenceOptions.productTypes.includes(formData.productType)) {
      setErrorMessage('Product type must be selected from Reference Data.');
      return false;
    }
    if (!referenceOptions.currencies.includes(formData.currency)) {
      setErrorMessage('Currency must be selected from Reference Data.');
      return false;
    }
    if (!referenceOptions.dayCountConventions.includes(formData.dayCountConvention)) {
      setErrorMessage('Day count must be selected from Reference Data.');
      return false;
    }
    if (!referenceOptions.accrualFrequencies.includes(formData.accrualFrequency)) {
      setErrorMessage('Accrual frequency must be selected from Reference Data.');
      return false;
    }
    if (!referenceOptions.payoutFrequencies.includes(formData.payoutFrequency)) {
      setErrorMessage('Payout frequency must be selected from Reference Data.');
      return false;
    }
    if (!referenceOptions.compoundingTypes.includes(formData.compounding)) {
      setErrorMessage('Compounding must be selected from Reference Data.');
      return false;
    }
    if (!referenceOptions.roundingScales.includes(formData.roundingScale)) {
      setErrorMessage('Rounding scale must be selected from Reference Data.');
      return false;
    }
    if (!referenceOptions.roundingModes.includes(formData.roundingMode)) {
      setErrorMessage('Rounding mode must be selected from Reference Data.');
      return false;
    }

    setErrorMessage('');
    return true;
  };

  const buildProductPayload = (status: InterestApprovalState): Partial<Omit<InterestProduct, 'id'>> => {
    const nowIso = new Date().toISOString();
    const payload: any = {
      productCode: formData.productCode.trim().toUpperCase(),
      name: formData.name.trim(),
      productType: formData.productType as InterestProductType,
      currency: formData.currency.trim(),
      dayCountConvention: formData.dayCountConvention as DayCountConvention,
      accrualFrequency: formData.accrualFrequency as AccrualFrequency,
      payoutFrequency: formData.payoutFrequency as PayoutFrequency,
      compounding: formData.compounding as CompoundingType,
      roundingScale: Number(formData.roundingScale),
      roundingMode: formData.roundingMode.trim() || 'HALF_UP',
      minimumBalance: Number(formData.minimumBalance || 0),
      allowNegativeRates: !!formData.allowNegativeRates,
      status,
      tenantId: effectiveTenantId,
      makerName: editingProduct?.makerName || currentUser?.name || 'Unknown User',
      makerEmail: editingProduct?.makerEmail || currentUser?.email || '',
      makerTimestamp: editingProduct?.makerTimestamp || nowIso,
      lastModifiedBy: currentUser?.email || 'usr_admin',
      lastModifiedAt: nowIso,
    };

    // Preserve checker fields if they exist during edit; omit if creating new product
    if (editingProduct?.checkerName) payload.checkerName = editingProduct.checkerName;
    if (editingProduct?.checkerEmail) payload.checkerEmail = editingProduct.checkerEmail;
    if (editingProduct?.checkerTimestamp) payload.checkerTimestamp = editingProduct.checkerTimestamp;

    // Remove any remaining undefined values to prevent Firebase errors
    Object.keys(payload).forEach(key => {
      if (payload[key] === undefined) delete payload[key];
    });

    return payload as Partial<Omit<InterestProduct, 'id'>>;
  };

  const syncProductSetupByCode = async (
    payload: Partial<Omit<InterestProduct, 'id'>>,
    previousProductCode?: string
  ) => {
    const productCodeKey = payload.productCode!.trim().toUpperCase();
    const byCodePath = `banking/interestProductSetupByCode/${effectiveTenantId}/${productCodeKey}`;

    if (previousProductCode && previousProductCode.trim().toUpperCase() !== productCodeKey) {
      await remove(ref(db, `banking/interestProductSetupByCode/${effectiveTenantId}/${previousProductCode.trim().toUpperCase()}`));
    }

    await set(ref(db, byCodePath), {
      productCode: productCodeKey,
      productType: payload.productType,
      currency: payload.currency,
      dayCountConvention: payload.dayCountConvention,
      accrualFrequency: payload.accrualFrequency,
      payoutFrequency: payload.payoutFrequency,
      compounding: payload.compounding,
      roundingScale: payload.roundingScale,
      roundingMode: payload.roundingMode,
      tenantId: effectiveTenantId,
      lastModifiedBy: payload.lastModifiedBy,
      lastModifiedAt: payload.lastModifiedAt,
    });
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
        await syncProductSetupByCode(payload, editingProduct.productCode);

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
        await syncProductSetupByCode(payload);

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
        resetForm();
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
      await remove(ref(db, `banking/interestProductSetupByCode/${effectiveTenantId}/${product.productCode.trim().toUpperCase()}`));
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
        {isLoadingReferenceData ? (
          <div className="mb-4 px-3 py-2 rounded-lg bg-blue-50 text-blue-800 text-sm border border-blue-200">
            Loading interest product reference options...
          </div>
        ) : missingReferenceFields.length > 0 ? (
          <div className="mb-4 px-3 py-2 rounded-lg bg-amber-50 text-amber-800 text-sm border border-amber-200">
            Missing reference values for: {missingReferenceFields.join(', ')}. Add them in Reference Data before saving products.
          </div>
        ) : null}
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
              {referenceOptions.productTypes.map((option) => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Currency</label>
            <select name="currency" value={formData.currency} onChange={handleInputChange} className="w-full border border-gray-300 rounded-lg px-3 py-2">
              {referenceOptions.currencies.map((option) => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Day Count</label>
            <select name="dayCountConvention" value={formData.dayCountConvention} onChange={handleInputChange} className="w-full border border-gray-300 rounded-lg px-3 py-2">
              {referenceOptions.dayCountConventions.map((option) => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Accrual Frequency</label>
            <select name="accrualFrequency" value={formData.accrualFrequency} onChange={handleInputChange} className="w-full border border-gray-300 rounded-lg px-3 py-2">
              {referenceOptions.accrualFrequencies.map((option) => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Payout Frequency</label>
            <select name="payoutFrequency" value={formData.payoutFrequency} onChange={handleInputChange} className="w-full border border-gray-300 rounded-lg px-3 py-2">
              {referenceOptions.payoutFrequencies.map((option) => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Compounding</label>
            <select name="compounding" value={formData.compounding} onChange={handleInputChange} className="w-full border border-gray-300 rounded-lg px-3 py-2">
              {referenceOptions.compoundingTypes.map((option) => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Rounding Scale</label>
            <select name="roundingScale" value={formData.roundingScale} onChange={handleInputChange} className="w-full border border-gray-300 rounded-lg px-3 py-2">
              {referenceOptions.roundingScales.map((option) => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Rounding Mode</label>
            <select name="roundingMode" value={formData.roundingMode} onChange={handleInputChange} className="w-full border border-gray-300 rounded-lg px-3 py-2">
              {referenceOptions.roundingModes.map((option) => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
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
