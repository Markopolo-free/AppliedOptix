import React, { useState, useEffect } from 'react';
import { getDatabase, ref, onValue, push, update, remove } from 'firebase/database';

type StatusType = 'active' | 'suspended' | 'no longer in use';

interface CompanyDetails {
  id: string;
  name: string;
  companyType: string;
  country: string;
  city: string;
  status: StatusType;
  dateActive?: string;
  dateSuspended?: string;
  dateNoLongerInUse?: string;
}

const CompanyDetailsManager: React.FC = () => {
  const [companies, setCompanies] = useState<CompanyDetails[]>([]);
  const [formData, setFormData] = useState<Partial<CompanyDetails>>({ status: 'active' });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [companyTypes, setCompanyTypes] = useState<string[]>([]);
  const [countries, setCountries] = useState<string[]>([]);
  const [cities, setCities] = useState<string[]>([]);
  const [showForm, setShowForm] = useState<boolean>(false);

  useEffect(() => {
    const db = getDatabase();
    // Load companies
    const companiesRef = ref(db, 'companies');
    const unsubCompanies = onValue(companiesRef, (snapshot) => {
      const data = snapshot.val() || {};
      const loaded = Object.entries(data).map(([id, value]: [string, any]) => ({ id, ...value }));
      setCompanies(loaded);
    });
    // Load company types
    const typesRef = ref(db, 'referenceCompanyTypes');
    const unsubTypes = onValue(typesRef, (snapshot) => {
      const data = snapshot.val() || {};
      const arr = Object.values(data).map((item) => (item as { name?: string }).name).filter(Boolean);
      setCompanyTypes([...new Set(arr)]);
    });
    // Load countries
    const countriesRef = ref(db, 'referenceCountries');
    const unsubCountries = onValue(countriesRef, (snapshot) => {
      const data = snapshot.val() || {};
      const arr = Object.values(data).map((item) => (item as { name?: string }).name).filter(Boolean);
      setCountries([...new Set(arr)]);
    });
    // Load cities
    const citiesRef = ref(db, 'referenceCities');
    const unsubCities = onValue(citiesRef, (snapshot) => {
      const data = snapshot.val() || {};
      const arr = Object.values(data).map((item) => (item as { name?: string }).name).filter(Boolean);
      setCities([...new Set(arr)]);
    });
    return () => {
      unsubCompanies();
      unsubTypes();
      unsubCountries();
      unsubCities();
    };
  }, []);

  const handleAddOrUpdate = () => {
    if (!formData.name?.trim() || !formData.companyType || !formData.country || !formData.city || !formData.status) {
      alert('All fields except dates are required.');
      return;
    }
    const db = getDatabase();
    if (editingId) {
      // Update
      const companyRef = ref(db, `companies/${editingId}`);
      update(companyRef, formData);
      setEditingId(null);
    } else {
      // Add new, system-generate ID
      const companiesRef = ref(db, 'companies');
      const newCompany = {
        ...formData,
        dateActive: formData.status === 'active' ? new Date().toISOString() : null,
        dateSuspended: formData.status === 'suspended' ? new Date().toISOString() : null,
        dateNoLongerInUse: formData.status === 'no longer in use' ? new Date().toISOString() : null,
      };
      // Remove undefined fields before push
      Object.keys(newCompany).forEach(key => {
        if (newCompany[key] === undefined) {
          delete newCompany[key];
        }
      });
      push(companiesRef, newCompany);
    }
    setFormData({ status: 'active' });
  };

  const handleEdit = (company: CompanyDetails) => {
    setEditingId(company.id);
    setFormData(company);
  };

  const handleDelete = async (id: string) => {
    if (!id) return;
    const db = getDatabase();
    const companyRef = ref(db, `companies/${id}`);
    await remove(companyRef);
    setCompanies(companies.filter(c => c.id !== id));
  };

  return (
    <div className="p-8 w-full mx-auto">
      <div className="flex justify-between items-center mb-6 w-full">
        <h1 className="text-3xl font-bold text-gray-800">Company Details Management</h1>
        <button
          onClick={() => { setEditingId(null); setFormData({ status: 'active' }); setShowForm(true); }}
          className="px-4 py-2 rounded-lg bg-primary-600 text-white hover:bg-primary-700 transition-colors"
        >
          Add Company
        </button>
      </div>
      <div className="bg-white rounded-lg shadow overflow-hidden w-full">
        <div className="overflow-x-auto max-h-[calc(100vh-200px)] overflow-y-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-blue-600 sticky top-0 z-10">
              <tr>
                <th className="px-6 py-4 text-left text-sm font-bold text-white uppercase tracking-wider border-b-2 border-blue-700">Name</th>
                <th className="px-6 py-4 text-left text-sm font-bold text-white uppercase tracking-wider border-b-2 border-blue-700">Type</th>
                <th className="px-6 py-4 text-left text-sm font-bold text-white uppercase tracking-wider border-b-2 border-blue-700">Country</th>
                <th className="px-6 py-4 text-left text-sm font-bold text-white uppercase tracking-wider border-b-2 border-blue-700">City</th>
                <th className="px-6 py-4 text-left text-sm font-bold text-white uppercase tracking-wider border-b-2 border-blue-700">Status</th>
                <th className="px-6 py-4 text-left text-sm font-bold text-white uppercase tracking-wider border-b-2 border-blue-700">Date Active</th>
                <th className="px-6 py-4 text-left text-sm font-bold text-white uppercase tracking-wider border-b-2 border-blue-700">Date Suspended</th>
                <th className="px-6 py-4 text-left text-sm font-bold text-white uppercase tracking-wider border-b-2 border-blue-700">Date No Longer In Use</th>
                <th className="px-6 py-4 text-right text-sm font-bold text-white uppercase tracking-wider border-b-2 border-blue-700">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {companies.length === 0 ? (
                <tr><td colSpan={9} className="text-center py-10 text-gray-500">No companies found.</td></tr>
              ) : (
                companies.map(company => (
                  <tr key={company.id}>
                    <td className="px-6 py-4 font-semibold">{company.name}</td>
                    <td className="px-6 py-4">{company.companyType}</td>
                    <td className="px-6 py-4">{company.country}</td>
                    <td className="px-6 py-4">{company.city}</td>
                    <td className="px-6 py-4">{company.status}</td>
                    <td className="px-6 py-4 whitespace-nowrap">{company.dateActive || '-'}</td>
                    <td className="px-6 py-4 whitespace-nowrap">{company.dateSuspended || '-'}</td>
                    <td className="px-6 py-4 whitespace-nowrap">{company.dateNoLongerInUse || '-'}</td>
                    <td className="px-6 py-4 text-right">
                      <button onClick={() => { handleEdit(company); setShowForm(true); }} className="px-2 py-1 bg-blue-500 text-white rounded mr-2 hover:bg-blue-600">Edit</button>
                      <button onClick={() => handleDelete(company.id)} className="px-2 py-1 bg-red-500 text-white rounded hover:bg-red-600">Delete</button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
      {/* Only show the form when adding or editing */}
      {showForm && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-8 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <h2 className="text-2xl font-bold mb-4">{editingId ? 'Edit Company' : 'Add Company'}</h2>
            <form onSubmit={e => { e.preventDefault(); handleAddOrUpdate(); }}>
              <div className="mb-2">
                <label className="block text-sm font-medium mb-1">Name</label>
                <input type="text" value={formData.name || ''} onChange={e => setFormData({ ...formData, name: e.target.value })} className="w-full px-3 py-2 border rounded" />
              </div>
              <div className="mb-2">
                <label className="block text-sm font-medium mb-1">Company Type</label>
                <select value={formData.companyType || ''} onChange={e => setFormData({ ...formData, companyType: e.target.value })} className="w-full px-3 py-2 border rounded">
                  <option value="">Select Type</option>
                  {companyTypes.map(type => <option key={type} value={type}>{type}</option>)}
                </select>
              </div>
              <div className="mb-2">
                <label className="block text-sm font-medium mb-1">Country</label>
                <select value={formData.country || ''} onChange={e => setFormData({ ...formData, country: e.target.value })} className="w-full px-3 py-2 border rounded">
                  <option value="">Select Country</option>
                  {[...new Set(countries)].map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="mb-2">
                <label className="block text-sm font-medium mb-1">City</label>
                <select value={formData.city || ''} onChange={e => setFormData({ ...formData, city: e.target.value })} className="w-full px-3 py-2 border rounded">
                  <option value="">Select City</option>
                  {[...new Set(cities)].map(city => <option key={city} value={city}>{city}</option>)}
                </select>
              </div>
              <div className="mb-2">
                <label className="block text-sm font-medium mb-1">Status</label>
                <select value={formData.status || 'active'} onChange={e => setFormData({ ...formData, status: e.target.value as StatusType })} className="w-full px-3 py-2 border rounded">
                  <option value="active">Active</option>
                  <option value="suspended">Suspended</option>
                  <option value="no longer in use">No Longer In Use</option>
                </select>
              </div>
              <div className="mb-2">
                <label className="block text-sm font-medium mb-1">Date Active</label>
                <input type="datetime-local" value={formData.dateActive ? formData.dateActive.substring(0, 16) : ''} onChange={e => setFormData({ ...formData, dateActive: e.target.value })} className="w-full px-3 py-2 border rounded" />
              </div>
              <div className="mb-2">
                <label className="block text-sm font-medium mb-1">Date Suspended</label>
                <input type="datetime-local" value={formData.dateSuspended ? formData.dateSuspended.substring(0, 16) : ''} onChange={e => setFormData({ ...formData, dateSuspended: e.target.value })} className="w-full px-3 py-2 border rounded" />
              </div>
              <div className="mb-2">
                <label className="block text-sm font-medium mb-1">Date No Longer In Use</label>
                <input type="datetime-local" value={formData.dateNoLongerInUse ? formData.dateNoLongerInUse.substring(0, 16) : ''} onChange={e => setFormData({ ...formData, dateNoLongerInUse: e.target.value })} className="w-full px-3 py-2 border rounded" />
              </div>
              <div className="flex gap-2 mt-4">
                <button type="submit" className="px-4 py-2 bg-blue-500 text-white rounded">{editingId ? 'Update' : 'Add'}</button>
                <button type="button" onClick={() => { setEditingId(null); setFormData({ status: 'active' }); setShowForm(false); }} className="px-4 py-2 bg-gray-300 rounded">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default CompanyDetailsManager;
