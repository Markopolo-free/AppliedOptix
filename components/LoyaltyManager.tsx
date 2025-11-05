import React, { useState, useCallback, useEffect } from 'react';
import { ref, get, push, set, serverTimestamp, update, remove, onValue, getDatabase } from 'firebase/database';
import { db } from '../services/firebase';
import { LoyaltyProgram, Bundle, Service, DiscountType } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { logAudit, calculateChanges } from '../services/auditService';

const initialNewProgramState = {
    name: '',
    description: '',
    cityName: '',
    pointsPerEuro: ''
};

const initialNewBundleState = {
    name: '',
    description: '',
    serviceIds: [] as string[],
    discountType: DiscountType.Percentage,
    discountValue: '',
    startDate: '',
    endDate: '',
};

const LoyaltyManager: React.FC = () => {
  const { currentUser } = useAuth();
  // State for Loyalty Programs
  const [programs, setPrograms] = useState<LoyaltyProgram[]>([]);
  const [isProgramModalOpen, setIsProgramModalOpen] = useState(false);
  const [newProgram, setNewProgram] = useState(initialNewProgramState);
  const [editingProgram, setEditingProgram] = useState<LoyaltyProgram | null>(null);

  // State for Bundles
  const [bundles, setBundles] = useState<Bundle[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [isBundleModalOpen, setIsBundleModalOpen] = useState(false);
  const [newBundle, setNewBundle] = useState(initialNewBundleState);
  const [editingBundle, setEditingBundle] = useState<Bundle | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [cities, setCities] = useState<Array<{ id: string; name: string; population: number }>>([]);

  // Fetch cities from reference data
  useEffect(() => {
    const database = getDatabase();
    const citiesRef = ref(database, 'referenceCities');
    const unsubscribe = onValue(citiesRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const citiesArray = Object.entries(data).map(([id, city]: [string, any]) => ({
          id,
          name: city.name,
          population: city.population
        }));
        // Sort by population (descending)
        citiesArray.sort((a, b) => b.population - a.population);
        setCities(citiesArray);
      }
    });

    return () => unsubscribe();
  }, []);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      // Fetch loyalty programs
      const programsRef = ref(db, 'loyaltyPrograms');
      const programsSnapshot = await get(programsRef);
      if (programsSnapshot.exists()) {
        const data = programsSnapshot.val();
        const list: LoyaltyProgram[] = Object.keys(data).map(key => ({ id: key, ...data[key], lastModifiedAt: new Date(data[key].lastModifiedAt).toISOString() }));
        list.sort((a, b) => new Date(b.lastModifiedAt).getTime() - new Date(a.lastModifiedAt).getTime());
        setPrograms(list);
      } else {
        setPrograms([]);
      }

      // Fetch bundles
      const bundlesRef = ref(db, 'bundles');
      const bundlesSnapshot = await get(bundlesRef);
      if (bundlesSnapshot.exists()) {
          const data = bundlesSnapshot.val();
          const list: Bundle[] = Object.keys(data).map(key => ({ id: key, ...data[key], serviceIds: data[key].serviceIds || [], lastModifiedAt: new Date(data[key].lastModifiedAt).toISOString() }));
          list.sort((a,b) => new Date(b.lastModifiedAt).getTime() - new Date(a.lastModifiedAt).getTime());
          setBundles(list);
      } else {
          setBundles([]);
      }

      // Fetch services for bundle creation
      const servicesRef = ref(db, 'services');
      const servicesSnapshot = await get(servicesRef);
      if(servicesSnapshot.exists()) {
          const data = servicesSnapshot.val();
          const list: Service[] = Object.keys(data).map(key => ({ id: key, ...data[key] }));
          setServices(list);
      } else {
          setServices([]);
      }

    } catch(error) {
      console.error("Error fetching data:", error);
      alert("Could not fetch data. See console for details.");
    } finally {
      setIsLoading(false);
    }
  }, []);
  
  useEffect(() => {
    fetchData();
  }, [fetchData]);
  
  // --- Loyalty Program Handlers ---
  const handleOpenProgramModalForAdd = () => {
      setEditingProgram(null);
      setNewProgram(initialNewProgramState);
      setIsProgramModalOpen(true);
  };
  
  const handleOpenProgramModalForEdit = (program: LoyaltyProgram) => {
      setEditingProgram(program);
      setNewProgram({ name: program.name, description: program.description, cityName: program.cityName || '', pointsPerEuro: String(program.pointsPerEuro) });
      setIsProgramModalOpen(true);
  };

  const handleProgramInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setNewProgram(prev => ({ ...prev, [name]: value }));
  };

  const handleSaveProgram = async (e: React.FormEvent) => {
    e.preventDefault();
    const programData = { name: newProgram.name, description: newProgram.description, cityName: newProgram.cityName, pointsPerEuro: parseInt(newProgram.pointsPerEuro, 10) || 0, lastModifiedBy: 'usr_admin', lastModifiedAt: serverTimestamp() };
    try {
        if (editingProgram) {
            await update(ref(db, `loyaltyPrograms/${editingProgram.id}`), programData);

            // Log audit for update
            if (currentUser) {
                const changes = calculateChanges(editingProgram, programData);
                await logAudit({
                    userId: currentUser.email,
                    userName: currentUser.name,
                    userEmail: currentUser.email,
                    action: 'update',
                    entityType: 'loyalty',
                    entityId: editingProgram.id,
                    entityName: programData.name,
                    changes,
                });
            }
        } else {
            const newProgramRef = push(ref(db, 'loyaltyPrograms'));
            await set(newProgramRef, programData);

            // Log audit for create
            if (currentUser) {
                await logAudit({
                    userId: currentUser.email,
                    userName: currentUser.name,
                    userEmail: currentUser.email,
                    action: 'create',
                    entityType: 'loyalty',
                    entityId: newProgramRef.key || '',
                    entityName: programData.name,
                });
            }
        }
        setIsProgramModalOpen(false);
        fetchData();
    } catch (error) {
        console.error("Error saving loyalty program:", error);
        alert("Failed to save loyalty program.");
    }
  };
  
  const handleDeleteProgram = async (programId: string) => {
      if (window.confirm('Are you sure you want to delete this loyalty program?')) {
          try {
              // Get program details before deletion for audit log
              const programToDelete = programs.find(p => p.id === programId);
              
              await remove(ref(db, `loyaltyPrograms/${programId}`));
              
              // Log audit for delete
              if (currentUser && programToDelete) {
                  await logAudit({
                      userId: currentUser.email,
                      userName: currentUser.name,
                      userEmail: currentUser.email,
                      action: 'delete',
                      entityType: 'loyalty',
                      entityId: programId,
                      entityName: programToDelete.name,
                  });
              }
              
              fetchData();
          } catch(error) {
              console.error("Error deleting program:", error);
              alert("Failed to delete loyalty program.");
          }
      }
  };

  // --- Bundled Pricing Handlers ---
  const handleOpenBundleModalForAdd = () => {
    setEditingBundle(null);
    setNewBundle(initialNewBundleState);
    setIsBundleModalOpen(true);
  };

  const handleOpenBundleModalForEdit = (bundle: Bundle) => {
    setEditingBundle(bundle);
    setNewBundle({
        name: bundle.name,
        description: bundle.description,
        serviceIds: bundle.serviceIds,
        discountType: bundle.discountType,
        discountValue: String(bundle.discountValue),
        startDate: bundle.startDate,
        endDate: bundle.endDate,
    });
    setIsBundleModalOpen(true);
  };

  const handleBundleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setNewBundle(prev => ({ ...prev, [name]: value }));
  };
  
  const handleServiceSelectionChange = (serviceId: string) => {
    setNewBundle(prev => {
        const currentServiceIds = prev.serviceIds || [];
        const newServiceIds = currentServiceIds.includes(serviceId)
            ? currentServiceIds.filter(id => id !== serviceId)
            : [...currentServiceIds, serviceId];
        return { ...prev, serviceIds: newServiceIds };
    });
  };

  const handleSaveBundle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBundle.serviceIds || newBundle.serviceIds.length < 2) {
        alert("Please select at least two services to create a bundle.");
        return;
    }
    const bundleData = { ...newBundle, discountValue: parseFloat(newBundle.discountValue) || 0, lastModifiedBy: 'usr_admin', lastModifiedAt: serverTimestamp() };
    try {
        if (editingBundle) {
            await update(ref(db, `bundles/${editingBundle.id}`), bundleData);
        } else {
            await set(push(ref(db, 'bundles')), bundleData);
        }
        setIsBundleModalOpen(false);
        fetchData();
    } catch (error) {
        console.error("Error saving bundle:", error);
        alert("Failed to save bundle.");
    }
  };

  const handleDeleteBundle = async (bundleId: string) => {
      if(window.confirm("Are you sure you want to delete this bundle?")) {
          try {
              await remove(ref(db, `bundles/${bundleId}`));
              fetchData();
          } catch(error) {
              console.error("Error deleting bundle:", error);
              alert("Failed to delete bundle.");
          }
      }
  };
  
  const getServiceName = (serviceId: string) => services.find(s => s.id === serviceId)?.name || serviceId;

  return (
    <div>
      <h1 className="text-3xl font-bold text-gray-800 mb-8">Loyalty Management</h1>

      {/* --- Points Programs Section --- */}
      <div className="mb-12">
        <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-semibold text-gray-700">Points Programs</h2>
            <button onClick={handleOpenProgramModalForAdd} className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors">
            Add Program
            </button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {isLoading ? <p className="text-gray-500 col-span-full">Loading...</p> : programs.length === 0 ? (
                <p className="text-gray-500 col-span-full">No loyalty programs found.</p>
            ) : (
                programs.map((program) => (
                <div key={program.id} className="bg-white p-6 rounded-xl shadow-md border border-gray-200 flex flex-col justify-between">
                    <div>
                        <div className="flex items-center justify-between">
                            <h3 className="text-xl font-bold text-gray-800">{program.name}</h3>
                            {program.cityName && (
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary-100 text-primary-800">
                                    📍 {program.cityName}
                                </span>
                            )}
                        </div>
                        <p className="text-gray-600 mt-2">{program.description}</p>
                        <div className="mt-4"><span className="text-sm font-medium text-gray-500">Points per € spent</span><p className="text-2xl font-bold text-primary-600">{program.pointsPerEuro}</p></div>
                        <div className="text-xs text-gray-400 mt-4">Last modified: {new Date(program.lastModifiedAt).toLocaleString()} by {program.lastModifiedBy}</div>
                    </div>
                    <div className="mt-6 flex justify-end space-x-2"><button onClick={() => handleOpenProgramModalForEdit(program)} className="font-medium text-primary-600 hover:text-primary-900">Edit</button><button onClick={() => handleDeleteProgram(program.id)} className="font-medium text-red-600 hover:text-red-900">Delete</button></div>
                </div>
                ))
            )}
        </div>
      </div>

       {/* --- Bundled Pricing Section --- */}
       <div>
        <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-semibold text-gray-700">Bundled Pricing</h2>
            <button onClick={handleOpenBundleModalForAdd} className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors">
            Add Bundle
            </button>
        </div>
         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {isLoading ? <p className="text-gray-500 col-span-full">Loading...</p> : bundles.length === 0 ? (
                <p className="text-gray-500 col-span-full">No bundles found.</p>
            ) : (
                bundles.map((bundle) => (
                <div key={bundle.id} className="bg-white p-6 rounded-xl shadow-md border border-gray-200 flex flex-col justify-between">
                    <div>
                        <h3 className="text-xl font-bold text-gray-800">{bundle.name}</h3>
                        <p className="text-gray-600 mt-2">{bundle.description}</p>
                        <div className="mt-4">
                            <span className="text-sm font-medium text-gray-500">Includes</span>
                            <p className="text-gray-800 text-sm list-disc list-inside">{bundle.serviceIds.map(getServiceName).join(', ')}</p>
                        </div>
                        <div className="mt-4">
                             <span className="text-sm font-medium text-gray-500">Discount</span>
                             <p className="text-2xl font-bold text-primary-600">{bundle.discountType === DiscountType.Fixed ? `€${bundle.discountValue.toFixed(2)}` : `${bundle.discountValue}%`}</p>
                        </div>
                        <div className="text-xs text-gray-400 mt-4">Active: {new Date(bundle.startDate).toLocaleDateString()} - {new Date(bundle.endDate).toLocaleDateString()}</div>
                    </div>
                    <div className="mt-6 flex justify-end space-x-2"><button onClick={() => handleOpenBundleModalForEdit(bundle)} className="font-medium text-primary-600 hover:text-primary-900">Edit</button><button onClick={() => handleDeleteBundle(bundle.id)} className="font-medium text-red-600 hover:text-red-900">Delete</button></div>
                </div>
                ))
            )}
        </div>
      </div>
      
      {/* Program Modal */}
      {isProgramModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-40 flex justify-center items-center p-4">
            <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-md">
                <h2 className="text-2xl font-bold mb-6 text-gray-800">{editingProgram ? 'Edit Loyalty Program' : 'Add New Loyalty Program'}</h2>
                <form onSubmit={handleSaveProgram}>
                    <div className="mb-4"><label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">Program Name</label><input type="text" id="name" name="name" value={newProgram.name} onChange={handleProgramInputChange} className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500" required /></div>
                    <div className="mb-4"><label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">Description</label><textarea id="description" name="description" value={newProgram.description} onChange={handleProgramInputChange} rows={3} className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500" required></textarea></div>
                    <div className="mb-4">
                      <label htmlFor="cityName" className="block text-sm font-medium text-gray-700 mb-1">City</label>
                      <select 
                        id="cityName" 
                        name="cityName" 
                        value={newProgram.cityName} 
                        onChange={handleProgramInputChange} 
                        className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                      >
                        <option value="">Select a city...</option>
                        {cities.map((city) => (
                          <option key={city.id} value={city.name}>
                            {city.name}
                          </option>
                        ))}
                      </select>
                      {cities.length === 0 && (
                        <p className="mt-1 text-sm text-gray-500">
                          No cities available. Add cities in Reference Data first.
                        </p>
                      )}
                    </div>
                    <div className="mb-4"><label htmlFor="pointsPerEuro" className="block text-sm font-medium text-gray-700 mb-1">Points Per Euro</label><input type="number" id="pointsPerEuro" name="pointsPerEuro" value={newProgram.pointsPerEuro} onChange={handleProgramInputChange} min="0" step="0.01" className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500" required /></div>
                    <div className="flex justify-end space-x-4"><button type="button" onClick={() => setIsProgramModalOpen(false)} className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300">Cancel</button><button type="submit" className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700">{editingProgram ? 'Save Changes' : 'Save Program'}</button></div>
                </form>
            </div>
        </div>
      )}

      {/* Bundle Modal */}
       {isBundleModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-40 flex justify-center items-center p-4">
            <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-lg max-h-full overflow-y-auto">
                <h2 className="text-2xl font-bold mb-6 text-gray-800">{editingBundle ? 'Edit Bundle' : 'Add New Bundle'}</h2>
                <form onSubmit={handleSaveBundle}>
                    <div className="grid grid-cols-1 gap-y-4 gap-x-4 sm:grid-cols-2">
                        <div className="sm:col-span-2"><label htmlFor="bundleName" className="block text-sm font-medium text-gray-700">Bundle Name</label><input type="text" name="name" id="bundleName" value={newBundle.name} onChange={handleBundleInputChange} className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm" required /></div>
                        <div className="sm:col-span-2"><label htmlFor="bundleDescription" className="block text-sm font-medium text-gray-700">Description</label><textarea name="description" id="bundleDescription" value={newBundle.description} onChange={handleBundleInputChange} rows={3} className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm"></textarea></div>
                        <div className="sm:col-span-2">
                            <label className="block text-sm font-medium text-gray-700">Services</label>
                            <div className="mt-2 p-2 border border-gray-300 rounded-md max-h-40 overflow-y-auto">{services.map(service => (
                                <div key={service.id} className="flex items-center my-1"><input id={`bundle-service-${service.id}`} type="checkbox" checked={(newBundle.serviceIds || []).includes(service.id)} onChange={() => handleServiceSelectionChange(service.id)} className="h-4 w-4 text-primary-600 border-gray-300 rounded" /><label htmlFor={`bundle-service-${service.id}`} className="ml-3 text-sm text-gray-700">{service.name}</label></div>
                            ))}</div>
                        </div>
                        <div><label htmlFor="discountType" className="block text-sm font-medium text-gray-700">Discount Type</label><select name="discountType" value={newBundle.discountType} onChange={handleBundleInputChange} className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm"><option value={DiscountType.Percentage}>Percentage</option><option value={DiscountType.Fixed}>Fixed Amount</option></select></div>
                        <div><label htmlFor="discountValue" className="block text-sm font-medium text-gray-700">Discount Value</label><input type="number" name="discountValue" value={newBundle.discountValue} onChange={handleBundleInputChange} className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm" required /></div>
                        <div><label htmlFor="startDate" className="block text-sm font-medium text-gray-700">Start Date</label><input type="date" name="startDate" value={newBundle.startDate} onChange={handleBundleInputChange} className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm" required /></div>
                        <div><label htmlFor="endDate" className="block text-sm font-medium text-gray-700">End Date</label><input type="date" name="endDate" value={newBundle.endDate} onChange={handleBundleInputChange} className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm" required /></div>
                    </div>
                    <div className="mt-8 flex justify-end space-x-4"><button type="button" onClick={() => setIsBundleModalOpen(false)} className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300">Cancel</button><button type="submit" className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700">{editingBundle ? 'Save Changes' : 'Save Bundle'}</button></div>
                </form>
            </div>
        </div>
      )}
    </div>
  );
};

export default LoyaltyManager;