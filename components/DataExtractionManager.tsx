import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { logAudit } from '../services/auditService';
import { ref, get, push, remove, onValue } from 'firebase/database';
import { db } from '../services/firebase';

const DATA_SOURCES = [
  { key: 'pricingRules', label: 'Pricing Rules' },
  { key: 'campaigns', label: 'Campaigns' },
  { key: 'loyaltyPoints', label: 'Loyalty Management Points' },
  { key: 'loyaltyBundles', label: 'Loyalty Management Bundled Pricing' },
  { key: 'userDiscountGroups', label: 'User Discount Groups' },
];

// Moved extract selection dropdown to appear before the Select Fields to Extract step
const DataExtractionManager: React.FC = () => {
  const { currentUser } = useAuth();
  const [step, setStep] = useState(1);
  const [selectedSource, setSelectedSource] = useState<string>('');
  const [selectedFields, setSelectedFields] = useState<string[]>([]);
  const [extracts, setExtracts] = useState<any[]>([]);
  const [selectedExtractIdx, setSelectedExtractIdx] = useState<number | null>(null);
  const [newExtractId, setNewExtractId] = useState<string | null>(null);
  const [extractName, setExtractName] = useState('');


  // Load extracts from Firebase on mount
  useEffect(() => {
    const extractsRef = ref(db, 'dataExtracts');
    const unsubscribe = onValue(extractsRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const arr = Object.entries(data).map(([id, item]: [string, any]) => ({ ...item, id }));
        setExtracts(arr);
      } else {
        setExtracts([]);
      }
    });
    return () => unsubscribe();
  }, []);

  // Placeholder for field options per source
  const FIELD_OPTIONS: Record<string, string[]> = {
    pricingRules: [
      'id', 'serviceReferenceNumber', 'description', 'serviceIds', 'serviceTypeEntries', 'basis', 'rate', 'userGroup', 'minimumUsage', 'zoneId', 'zoneDiscount', 'conditions', 'status', 'makerName', 'makerEmail', 'makerTimestamp', 'checkerName', 'checkerEmail', 'checkerTimestamp', 'lastModifiedBy', 'lastModifiedAt'
    ],
    campaigns: [
      'id', 'name', 'description', 'serviceIds', 'discountType', 'discountValue', 'startDate', 'endDate', 'countryId', 'cityId', 'hasQualifyingCriteria', 'qualifyingOperator', 'qualifyingServiceId', 'qualifyingServiceIds', 'criteriaType', 'minDistanceKm', 'minRides', 'qualifyStartDate', 'qualifyEndDate', 'qualifyingCriteria', 'rewardAvailableFrom', 'status', 'makerName', 'makerEmail', 'makerTimestamp', 'checkerName', 'checkerEmail', 'checkerTimestamp', 'lastModifiedBy', 'lastModifiedAt'
    ],
    loyaltyPoints: [
      'id', 'name', 'description', 'cityName', 'pointsPerEuro', 'maxPointsPerUser', 'totalPointsAvailable', 'pointsConsumed', 'status', 'makerName', 'makerEmail', 'makerTimestamp', 'checkerName', 'checkerEmail', 'checkerTimestamp', 'lastModifiedBy', 'lastModifiedAt'
    ],
    loyaltyBundles: [
      'id', 'name', 'description', 'serviceIds', 'discountType', 'discountValue', 'startDate', 'endDate', 'lastModifiedBy', 'lastModifiedAt'
    ],
    userDiscountGroups: [
      'id', 'name', 'serviceIds', 'discountType', 'discountValue', 'capType', 'capValue', 'capPeriod', 'effectiveDate', 'expiryDate', 'lastModifiedBy', 'lastModifiedAt'
    ],
  };

  // Helper to fetch data for a source from Firebase
  const fetchData = async (source: string) => {
    let path = '';
    switch (source) {
      case 'pricingRules':
        path = 'pricingRules';
        break;
      case 'campaigns':
        path = 'campaigns';
        break;
              <label className="block mb-2 font-semibold">Load Previous Extract</label>
      case 'loyaltyPoints':
        path = 'loyaltyPrograms';
        break;
      case 'loyaltyBundles':
        path = 'bundles';
        break;
      case 'userDiscountGroups':
        path = 'userDiscountGroups';
        break;
      default:
        return [];
    }
    const snapshot = await get(ref(db, path));
    if (!snapshot.exists()) return [];
    const data = snapshot.val();
    return Object.keys(data).map(key => ({ id: key, ...data[key] }));
  };

  // Helper to create CSV from array of objects and selected fields
  const createCSV = (data: any[], fields: string[]) => {
    const header = fields.join(',');
    const rows = data.map(row => fields.map(f => JSON.stringify(row[f] ?? '')).join(','));
    return [header, ...rows].join('\r\n');
  };

  // Wizard steps
  const renderStep = () => {
    switch (step) {
      case 1:
        return (
          <div>
            <h2 className="text-xl font-bold mb-4">Create New Extract</h2>
            <div className="grid grid-cols-1 gap-4 mb-6">
              {DATA_SOURCES.map(source => (
                <button
                  key={source.key}
                  className={`px-4 py-2 rounded-lg border ${selectedSource === source.key ? 'bg-blue-600 text-white' : 'bg-white text-gray-800'}`}
                  onClick={() => {
                    setSelectedSource(source.key);
                    setSelectedFields([]);
                    setSelectedExtractIdx(null);
                  }}
                >
                  {source.label}
                </button>
              ))}
            </div>
            <div className="mt-6 flex justify-end">
              <button
                className="px-4 py-2 bg-primary-600 text-white rounded-lg"
                disabled={!selectedSource}
                onClick={() => setStep(2)}
              >Next</button>
            </div>
            <hr className="my-8" />
            <h2 className="text-xl font-bold mb-4">Load Previous Extract</h2>
            <label className="block mb-2 font-semibold">Select Extract</label>
            <select
              className="mb-6 px-3 py-2 border rounded w-full"
              value={selectedExtractIdx ?? ''}
              onChange={e => {
                const idx = e.target.value === '' ? null : Number(e.target.value);
                setSelectedExtractIdx(idx);
                if (idx !== null) {
                  const ex = extracts[idx];
                  setSelectedSource(ex.source);
                  setSelectedFields(ex.fields);
                  setStep(4);
                }
              }}
            >
              <option value="">-- Choose an extract --</option>
              {extracts.map((ex, idx) => (
                <option key={idx} value={idx}>{typeof ex.name === 'string' ? ex.name : `Extract ${idx + 1}`}</option>
              ))}
            </select>
          </div>
        );
      case 2:
        return (
          <div>
            <h2 className="text-xl font-bold mb-4">Select Fields to Extract</h2>
            <div className="grid grid-cols-2 gap-4">
              {FIELD_OPTIONS[selectedSource]?.map(field => (
                <label key={field} className="flex items-center">
                  <input
                    type="checkbox"
                    checked={selectedFields.includes(field)}
                    onChange={e => {
                      setSelectedFields(prev =>
                        e.target.checked
                          ? [...prev, field]
                          : prev.filter(f => f !== field)
                      );
                    }}
                  />
                  <span className="ml-2">{field}</span>
                </label>
              ))}
            </div>
            <div className="mt-6 flex justify-between">
              <button className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg" onClick={() => setStep(1)}>Back</button>
              <button
                className="px-4 py-2 bg-primary-600 text-white rounded-lg"
                disabled={selectedFields.length === 0}
                onClick={() => setStep(3)}
              >Next</button>
            </div>
          </div>
        );
      case 3:
        return (
          <div>
            <h2 className="text-xl font-bold mb-4">Configure & Run Extract</h2>
            <label className="block mb-2 font-semibold">Extract Name</label>
            <input
              type="text"
              className="w-full mb-4 px-3 py-2 border rounded"
              value={extractName}
              onChange={e => setExtractName(e.target.value)}
              placeholder="e.g. Pricing Rules Nov 2025"
            />
            <p className="mb-4">(Filters and advanced options can be added here.)</p>
            <div className="mt-6 flex justify-between">
              <button className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg" onClick={() => setStep(2)}>Back</button>
              <button
                className="px-4 py-2 bg-green-600 text-white rounded-lg"
                disabled={!extractName}
                 onClick={async () => {
                   // Fetch actual data and save extract
                   const data = await fetchData(selectedSource);
                   // Save new extract to Firebase
                   const extractsRef = ref(db, 'dataExtracts');
                   const newRef = await push(extractsRef, {
                     name: extractName,
                     source: selectedSource,
                     fields: selectedFields,
                     date: new Date().toISOString(),
                     data
                   });
                   // Log audit for running extract
                   if (currentUser) {
                     await logAudit({
                       userId: currentUser.email,
                       userName: currentUser.name,
                       userEmail: currentUser.email,
                       action: 'create',
                       entityType: 'reference',
                       entityName: extractName,
                       changes: [
                         { field: 'Data Extract', oldValue: null, newValue: extractName }
                       ],
                       metadata: {
                         source: selectedSource,
                         fields: selectedFields,
                         runDate: new Date().toISOString()
                       }
                     });
                   }
                   setNewExtractId(newRef.key);
                   setStep(4);
                 }}
              >Run Extract</button>
            </div>
          </div>
        );
      case 4:
        // Show the newly created extract if newExtractId is set, otherwise use dropdown selection
        const selectedExtract =
          newExtractId
            ? extracts.find(e => e.id === newExtractId)
            : selectedExtractIdx !== null
              ? extracts[selectedExtractIdx]
              : null;
        return (
          <div>
            <h2 className="text-xl font-bold mb-4">Extracts</h2>
            <label className="block mb-2 font-semibold">Select Extract</label>
            <select
              className="mb-6 px-3 py-2 border rounded w-full"
              value={selectedExtractIdx ?? ''}
              onChange={e => {
                setSelectedExtractIdx(e.target.value === '' ? null : Number(e.target.value));
                setNewExtractId(null);
              }}
            >
              <option value="">-- Choose an extract --</option>
              {extracts.map((ex, idx) => (
                <option key={ex.id || idx} value={idx}>{typeof ex.name === 'string' ? ex.name : `Extract ${idx + 1}`}</option>
              ))}
            </select>
            {selectedExtract && (
              <div className="mb-6 p-4 border rounded bg-gray-50">
                <div className="mb-2"><strong>Name:</strong> {selectedExtract.name}</div>
                <div className="mb-2"><strong>Source:</strong> {DATA_SOURCES.find(s => s.key === selectedExtract.source)?.label}</div>
                <div className="mb-2"><strong>Fields:</strong> {selectedExtract.fields.join(', ')}</div>
                <div className="mb-2"><strong>Date:</strong> {new Date(selectedExtract.date).toLocaleString()}</div>
                <div className="flex gap-2 mt-2">
                  <button className="px-2 py-1 bg-green-600 text-white rounded" onClick={() => {
                    const csv = createCSV(selectedExtract.data ?? [], selectedExtract.fields);
                    const blob = new Blob([csv], { type: 'text/csv' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `${typeof selectedExtract.name === 'string' ? selectedExtract.name : 'extract'}.csv`;
                    a.click();
                    URL.revokeObjectURL(url);
                  }}>Download CSV</button>
                  <button className="px-2 py-1 bg-red-500 text-white rounded" onClick={async () => {
                    // Delete extract from Firebase
                    if (selectedExtract && selectedExtract.id) {
                      await remove(ref(db, `dataExtracts/${selectedExtract.id}`));
                    }
                    setSelectedExtractIdx(null);
                    setNewExtractId(null);
                  }}>Delete</button>
                </div>
              </div>
            )}
            <table className="min-w-full text-sm mb-6">
              <thead>
                <tr>
                  <th className="px-4 py-2">Name</th>
                  <th className="px-4 py-2">Source</th>
                  <th className="px-4 py-2">Fields</th>
                  <th className="px-4 py-2">Date</th>
                </tr>
              </thead>
              <tbody>
                {extracts.map((ex, idx) => (
                  <tr key={idx}>
                    <td className="px-4 py-2 font-semibold">{typeof ex.name === 'string' ? ex.name : ''}</td>
                    <td className="px-4 py-2">{DATA_SOURCES.find(s => s.key === ex.source)?.label}</td>
                    <td className="px-4 py-2">{ex.fields.join(', ')}</td>
                    <td className="px-4 py-2">{new Date(ex.date).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="mt-6 flex justify-end">
              <button className="px-4 py-2 bg-primary-600 text-white rounded-lg" onClick={() => setStep(1)}>Create New Extract</button>
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-6">Data Extraction Wizard</h1>
      <div className="bg-white shadow rounded-lg p-6 max-w-2xl mx-auto">
        {renderStep()}
      </div>
    </div>
  );
};

export default DataExtractionManager;
