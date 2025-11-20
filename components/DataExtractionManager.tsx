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
  { key: 'fxcampaigns', label: 'FX Campaigns' },
  { key: 'fxdiscountoptions', label: 'FX Discount Groups' },
  { key: 'fxpricing', label: 'FX Pricing' },
];

// Moved extract selection dropdown to appear before the Select Fields to Extract step
const DataExtractionManager: React.FC = () => {
  const { currentUser } = useAuth();
  const [step, setStep] = useState(1);
  const [selectedSource, setSelectedSource] = useState<string>('');
  const [selectedFields, setSelectedFields] = useState<string[]>([]);
  const [extracts, setExtracts] = useState<any[]>([]);
  const [selectedExtractIdx, setSelectedExtractIdx] = useState<string | null>(null);
  const [newExtractId, setNewExtractId] = useState<string | null>(null);
  const [extractName, setExtractName] = useState('');
  // Fix: orderedFields state for step 4 (existing extracts)
  const [orderedFields, setOrderedFields] = useState<string[]>([]);
  // Update orderedFields when selectedExtract changes
  React.useEffect(() => {
    const selectedExtract =
      newExtractId
        ? extracts.find(e => e.id === newExtractId)
        : selectedExtractIdx !== null
          ? extracts.find(e => e.id === selectedExtractIdx)
          : null;
    setOrderedFields(selectedExtract?.fields || []);
  }, [newExtractId, selectedExtractIdx, extracts]);


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
    fxcampaigns: [
      'id', 'name', 'description', 'startDate', 'endDate', 'currency', 'rate', 'status', 'makerName', 'makerEmail', 'makerTimestamp', 'checkerName', 'checkerEmail', 'checkerTimestamp', 'lastModifiedBy', 'lastModifiedAt'
    ],
    fxdiscountoptions: [
      'id', 'optionNumber', 'name', 'description', 'discountType', 'discountAmountType', 'discountAmount', 'serviceItem', 'fxSegment', 'maxCapType', 'currency', 'capPeriodStart', 'capPeriodEnd', 'startDate', 'endDate', 'lastModifiedBy', 'lastModifiedAt'
    ],
    fxpricing: [
      'id',
      'referenceNumber',
      'entity',
      'country',
      'baseCurrency',
      'quoteCurrency',
      'segment',
      'channel',
      'loyaltyStatus',
      'tiers',
      'activeFromDate',
      'activeToDate',
      'status',
      'makerName',
      'makerEmail',
      'makerTimestamp',
      'checkerName',
      'checkerEmail',
      'checkerTimestamp',
      'lastModifiedBy',
      'lastModifiedAt'
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
      case 'loyaltyPoints':
        path = 'loyaltyPrograms';
        break;
      case 'loyaltyBundles':
        path = 'bundles';
        break;
      case 'userDiscountGroups':
        path = 'userDiscountGroups';
        break;
      case 'fxcampaigns':
        path = 'fxCampaigns';
        break;
      case 'fxdiscountoptions':
        path = 'fxDiscountOptions';
        break;
      case 'fxpricing':
        path = 'fxPricings';
        break;
      default:
        console.log('[Extract Debug] Unknown source:', source);
        return [];
    }
    console.log('[Extract Debug] Fetching data from path:', path);
    const snapshot = await get(ref(db, path));
    if (!snapshot.exists()) {
      console.log('[Extract Debug] No data found at path:', path);
      return [];
    }
    const data = snapshot.val();
    console.log('[Extract Debug] Raw data:', data);
    const result = Object.keys(data).map(key => ({ id: key, ...data[key] }));
    console.log('[Extract Debug] Parsed result:', result);
    return result;
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
                const id = e.target.value === '' ? null : e.target.value;
                setSelectedExtractIdx(id);
                if (id !== null) {
                  const ex = extracts.find(extract => extract.id === id);
                  if (ex) {
                    setSelectedSource(ex.source);
                    setSelectedFields(ex.fields);
                    setStep(4);
                  }
                }
              }}
            >
              <option value="">-- Choose an extract --</option>
              {extracts.map((ex) => (
                <option key={ex.id} value={ex.id}>{typeof ex.name === 'string' ? ex.name : `Extract`}</option>
              ))}
            </select>
          </div>
        );
      case 2:
        return (
          <div>
            <h2 className="text-xl font-bold mb-4">Select & Order Fields to Extract</h2>
            <div className="grid grid-cols-2 gap-4 mb-6">
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
            {selectedFields.length > 0 && (
              <div className="mb-6">
                <h3 className="font-semibold mb-2">Order Selected Fields</h3>
                <ul className="list-none p-0">
                  {selectedFields.map((field, idx) => (
                    <li key={field} className="flex items-center mb-2">
                      <span className="flex-1">{field}</span>
                      <button
                        className="px-2 py-1 bg-gray-200 rounded mr-2"
                        disabled={idx === 0}
                        onClick={() => {
                          setSelectedFields(prev => {
                            const arr = [...prev];
                            [arr[idx - 1], arr[idx]] = [arr[idx], arr[idx - 1]];
                            return arr;
                          });
                        }}
                      >↑</button>
                      <button
                        className="px-2 py-1 bg-gray-200 rounded"
                        disabled={idx === selectedFields.length - 1}
                        onClick={() => {
                          setSelectedFields(prev => {
                            const arr = [...prev];
                            [arr[idx], arr[idx + 1]] = [arr[idx + 1], arr[idx]];
                            return arr;
                          });
                        }}
                      >↓</button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
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
                   alert('Run Extract button clicked!');
                   console.log('[Extract Debug] Run Extract button clicked!');
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
              ? extracts.find(e => e.id === selectedExtractIdx)
              : null;
        // Helper for async extract deletion
        const handleDeleteExtract = async () => {
          if (selectedExtract && selectedExtract.id) {
            await remove(ref(db, `dataExtracts/${selectedExtract.id}`));
          }
          setSelectedExtractIdx(null);
          setNewExtractId(null);
        };
        // Helper for re-running extract
        const handleRerunExtract = async () => {
          if (!selectedExtract) return;
          alert('Re-Run Extract button clicked!');
          console.log('[Extract Debug] Re-Run Extract button clicked!');
          const data = await fetchData(selectedExtract.source);
          // Update the extract with new data and date
          await push(ref(db, 'dataExtracts'), {
            name: selectedExtract.name,
            source: selectedExtract.source,
            fields: selectedExtract.fields,
            date: new Date().toISOString(),
            data
          });
          // Optionally, log audit for re-run
          if (currentUser) {
            await logAudit({
              userId: currentUser.email,
              userName: currentUser.name,
              userEmail: currentUser.email,
              action: 'create',
              entityType: 'reference',
              entityName: selectedExtract.name,
              changes: [
                { field: 'Data Extract Re-Run', oldValue: null, newValue: selectedExtract.name }
              ],
              metadata: {
                source: selectedExtract.source,
                fields: selectedExtract.fields,
                runDate: new Date().toISOString()
              }
            });
          }
          // Refresh extracts list
          setNewExtractId(null);
        };
        return (
          <div>
            <h2 className="text-xl font-bold mb-4">Extracts</h2>
            <label className="block mb-2 font-semibold">Select Extract</label>
            <select
              className="mb-6 px-3 py-2 border rounded w-full"
              value={selectedExtractIdx ?? ''}
              onChange={e => {
                setSelectedExtractIdx(e.target.value === '' ? null : e.target.value);
                setNewExtractId(null);
              }}
            >
              <option value="">-- Choose an extract --</option>
              {extracts.map((ex) => (
                <option key={ex.id} value={ex.id}>{typeof ex.name === 'string' ? ex.name : `Extract`}</option>
              ))}
            </select>
            {selectedExtract && (
              <div className="mb-6 p-4 border rounded bg-gray-50">
                <div className="mb-2"><strong>Name:</strong> {selectedExtract.name}</div>
                <div className="mb-2"><strong>Source:</strong> {DATA_SOURCES.find(s => s.key === selectedExtract.source)?.label}</div>
                <div className="mb-2"><strong>Date:</strong> {new Date(selectedExtract.date).toLocaleString()}</div>
                <div className="mb-2"><strong>Fields:</strong></div>
                <ul className="list-none p-0 mb-2">
                  {orderedFields.map((field, idx) => (
                    <li key={field} className="flex items-center mb-1">
                      <span className="flex-1">{field}</span>
                      <button
                        className="px-2 py-1 bg-gray-200 rounded mr-2"
                        disabled={idx === 0}
                        onClick={() => {
                          setOrderedFields(prev => {
                            const arr = [...prev];
                            [arr[idx - 1], arr[idx]] = [arr[idx], arr[idx - 1]];
                            return arr;
                          });
                        }}
                      >↑</button>
                      <button
                        className="px-2 py-1 bg-gray-200 rounded"
                        disabled={idx === orderedFields.length - 1}
                        onClick={() => {
                          setOrderedFields(prev => {
                            const arr = [...prev];
                            [arr[idx], arr[idx + 1]] = [arr[idx + 1], arr[idx]];
                            return arr;
                          });
                        }}
                      >↓</button>
                    </li>
                  ))}
                </ul>
                <div className="flex gap-2 mt-2">
                  <button className="px-2 py-1 bg-green-600 text-white rounded" onClick={() => {
                    const csv = createCSV(selectedExtract.data ?? [], orderedFields);
                    const blob = new Blob([csv], { type: 'text/csv' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `${typeof selectedExtract.name === 'string' ? selectedExtract.name : 'extract'}.csv`;
                    a.click();
                    URL.revokeObjectURL(url);
                  }}>Download CSV</button>
                  <button className="px-2 py-1 bg-blue-500 text-white rounded" onClick={handleRerunExtract}>Re-Run Extract</button>
                  <button className="px-2 py-1 bg-red-500 text-white rounded" onClick={handleDeleteExtract}>Delete</button>
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
                {extracts.map((ex) => (
                  <tr key={ex.id}>
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
