import React, { useState, useEffect, useCallback } from 'react';
import { ref, get, push, set, serverTimestamp, update, remove, query, orderByChild, equalTo, onValue } from 'firebase/database';
import { db } from '../services/firebase';
import { Service, ServiceStatus } from '../types';
import { UserRole } from '../enums';
import { TENANT_FEATURE_MAP } from '../TenantFeatureConfig';
import { useAuth } from '../contexts/AuthContext';
import { logAudit, calculateChanges } from '../services/auditService';
import { queryServicesByTenant } from '../services/multiTenantService';

const initialNewServiceState = {
    name: '',
    description: '',
    type: 'Electric Car',
    price: '',
    minChargeAmount: '0.00',
    currency: 'EUR',
    pricingBasis: 'Distance (km)',
    period: '',
    status: ServiceStatus.Available,
    country: '',
    location: '',
    effectiveDate: new Date().toISOString().split('T')[0], // Default to today
};

const ServiceManager: React.FC = () => {
  const { currentUser, effectiveTenantId } = useAuth();
    const [services, setServices] = useState<Service[]>([]);
    const [serviceTypes, setServiceTypes] = useState<string[]>([]);
    const [countries, setCountries] = useState<string[]>([]);
    const [cities, setCities] = useState<{ id: string; name: string; country: string }[]>([]);
    const [filteredCities, setFilteredCities] = useState<string[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isAddTypeModalOpen, setIsAddTypeModalOpen] = useState(false);
    const [newTypeName, setNewTypeName] = useState("");
    const [formData, setFormData] = useState(initialNewServiceState);
    const [selectedTenantId, setSelectedTenantId] = useState<string>('');
    const [editingService, setEditingService] = useState<Service | null>(null);

    const fetchAndSeedServiceTypes = useCallback(async () => {
        // Load service types from reference data
        const typesRef = ref(db, 'referenceServiceTypes');
        const snapshot = await get(typesRef);
        let types: string[] = [];
        if (snapshot.exists()) {
            const data = snapshot.val();
            // Extract names from reference data structure
            types = Object.values(data).map((item: any) => item.name);
            setServiceTypes(types);
        } else {
            // If no reference data exists, provide empty array
            setServiceTypes([]);
        }
        // Ensure form default type is a valid one
        if (types.length > 0 && initialNewServiceState.type !== types[0]) {
            initialNewServiceState.type = types[0];
            setFormData(initialNewServiceState);
        }
    }, []);
    
    const fetchCountries = useCallback(async () => {
        const countriesRef = ref(db, 'referenceCountries');
        const snapshot = await get(countriesRef);
        if (snapshot.exists()) {
            const data = snapshot.val();
            const countryList = Object.values(data).map((item: any) => item.name).sort();
            setCountries(countryList);
        } else {
            setCountries([]);
        }
    }, []);

    const fetchCities = useCallback(async () => {
        const citiesRef = ref(db, 'referenceCities');
        const snapshot = await get(citiesRef);
        if (snapshot.exists()) {
            const data = snapshot.val();
            const cityList = Object.keys(data).map(key => ({
                id: key,
                name: data[key].name,
                country: data[key].country || ''
            }));
            console.log('Loaded cities:', cityList);
            console.log('Unique countries in cities:', [...new Set(cityList.map(c => c.country))]);
            setCities(cityList);
        } else {
            setCities([]);
        }
    }, []);
    
    const fetchServices = useCallback(async () => {
        try {
            const list = await queryServicesByTenant(effectiveTenantId);
            list.sort((a, b) => new Date(b.lastModifiedAt).getTime() - new Date(a.lastModifiedAt).getTime());
            setServices(list);
        } catch (error) {
            console.error('Error fetching services:', error);
            setServices([]);
        }
    }, [effectiveTenantId]);

    const fetchData = useCallback(async () => {
        setIsLoading(true);
        try {
            await fetchAndSeedServiceTypes();
            await fetchCountries();
            await fetchCities();
            await fetchServices();
        } catch (error) {
             console.error("Error fetching data: ", error);
            alert("Could not fetch data. See console for details.");
        } finally {
            setIsLoading(false);
        }
    }, [fetchAndSeedServiceTypes, fetchCountries, fetchCities, fetchServices]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    // Filter cities when country changes
    useEffect(() => {
        console.log('City filter effect triggered. Country:', formData.country, 'Total cities:', cities.length);
        if (formData.country) {
            const filtered = cities
                .filter(city => {
                    // Only include cities with a valid country, or legacy German cities
                    if (city.country === formData.country) return true;
                    if (!city.country && formData.country === 'Germany') return true;
                    // Ignore cities with empty country for other selections
                    return false;
                })
                .map(city => city.name)
                .sort();
            console.log('Filtered cities for', formData.country, ':', filtered);
            setFilteredCities(filtered);
            // Only reset location if it's not in the filtered list and it's not empty
            if (formData.location && filtered.length > 0 && !filtered.includes(formData.location)) {
                console.log('Resetting location because', formData.location, 'not in filtered list');
                setFormData(prev => ({ ...prev, location: '' }));
            }
        } else {
            console.log('No country selected, clearing filtered cities');
            setFilteredCities([]);
        }
    }, [formData.country, cities, formData.location]);

    const handleOpenModalForAdd = () => {
        setEditingService(null);
        setFormData(initialNewServiceState);
        setFilteredCities([]);
        setSelectedTenantId(effectiveTenantId);
        setIsModalOpen(true);
    };

    const handleOpenModalForEdit = (service: Service) => {
        setEditingService(service);
        const editData = {
            name: service.name,
            description: service.description,
            type: service.type,
            price: String(service.price),
            minChargeAmount: service.minChargeAmount !== undefined ? String(service.minChargeAmount) : '0.00',
            currency: service.currency,
            pricingBasis: service.pricingBasis || 'Distance (km)',
            period: (service as any).period || '',
            status: service.status,
            country: service.country || '',
            location: service.location,
            effectiveDate: service.effectiveDate || new Date().toISOString().split('T')[0],
        };
        setFormData(editData);
        setSelectedTenantId((service as any).tenantId || effectiveTenantId);
        
        // Pre-filter cities for the selected country - useEffect will handle this
        // but we set it here too in case cities are already loaded
        if (service.country) {
            const filtered = cities
                .filter(city => {
                    // Match exact country or include cities with empty country (legacy German cities)
                    if (city.country === service.country) return true;
                    // If city has no country and we're selecting Germany, include it (legacy data)
                    if (!city.country && service.country === 'Germany') return true;
                    return false;
                })
                .map(city => city.name)
                .sort();
            console.log('Filtering cities for country:', service.country, 'Found:', filtered.length, 'cities');
            setFilteredCities(filtered);
        }
        
        setIsModalOpen(true);
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSaveService = async (e: React.FormEvent) => {
        e.preventDefault();
        const serviceData = {
            ...formData,
            price: parseFloat(formData.price) || 0,
            minChargeAmount: parseFloat((formData as any).minChargeAmount) || 0,
            pricingBasis: formData.pricingBasis || 'Distance (km)',
            period: formData.pricingBasis === 'Fixed Fee' ? (formData as any).period : undefined,
            tenantId: selectedTenantId || effectiveTenantId,
            lastModifiedBy: currentUser?.email || 'usr_admin',
            lastModifiedAt: serverTimestamp(),
        };

        try {
            if (editingService) {
                const serviceRef = ref(db, `services/${editingService.id}`);
                await update(serviceRef, serviceData);

                // Log audit for update
                if (currentUser) {
                    const changes = calculateChanges(editingService, serviceData);
                    await logAudit({
                        userId: currentUser.email,
                        userName: currentUser.name,
                        userEmail: currentUser.email,
                        action: 'update',
                        entityType: 'service',
                        entityId: editingService.id,
                        entityName: serviceData.name,
                        changes,
                    });
                }
            } else {
                const servicesListRef = ref(db, 'services');
                const newServiceRef = push(servicesListRef);
                await set(newServiceRef, serviceData);

                // Log audit for create
                if (currentUser) {
                    await logAudit({
                        userId: currentUser.email,
                        userName: currentUser.name,
                        userEmail: currentUser.email,
                        action: 'create',
                        entityType: 'service',
                        entityId: newServiceRef.key || '',
                        entityName: serviceData.name,
                    });
                }
            }
            setIsModalOpen(false);
            setEditingService(null);
            await fetchServices();
        } catch (error) {
            console.error("Error saving service: ", error);
            alert("Failed to save service. See console for details.");
        }
    };

    const handleSaveNewType = async () => {
        const trimmedTypeName = newTypeName.trim();
        if (!trimmedTypeName) {
            alert("Please enter a name for the new service type.");
            return;
        }
        if (serviceTypes.includes(trimmedTypeName)) {
            alert("This service type already exists.");
            return;
        }
        // Save to reference data with proper structure
        const typesRef = ref(db, 'referenceServiceTypes');
        const newTypeRef = push(typesRef);
        try {
            await set(newTypeRef, {
                name: trimmedTypeName,
                dateAdded: new Date().toISOString(),
                addedBy: currentUser?.name || currentUser?.email || 'System'
            });
            const updatedTypes = [...serviceTypes, trimmedTypeName];
            setServiceTypes(updatedTypes);
            setFormData(prev => ({ ...prev, type: trimmedTypeName }));
            setNewTypeName("");
            setIsAddTypeModalOpen(false);
        } catch (error) {
            console.error("Error saving new service type:", error);
            alert("Failed to save new service type.");
        }
    };

    const handleDeleteService = async (serviceId: string) => {
        if (window.confirm('Are you sure you want to delete this service?')) {
            try {
                // Get service details before deletion for audit log
                const serviceToDelete = services.find(s => s.id === serviceId);
                
                await remove(ref(db, `services/${serviceId}`));
                
                // Log audit for delete
                if (currentUser && serviceToDelete) {
                    await logAudit({
                        userId: currentUser.email,
                        userName: currentUser.name,
                        userEmail: currentUser.email,
                        action: 'delete',
                        entityType: 'service',
                        entityId: serviceId,
                        entityName: serviceToDelete.name,
                    });
                }
                
                await fetchServices();
            } catch (error) {
                console.error("Error deleting service:", error);
                alert("Failed to delete service.");
            }
        }
    };
    
    const getStatusColor = (status: ServiceStatus) => {
        switch (status) {
            case ServiceStatus.Available: return 'bg-green-100 text-green-800';
            case ServiceStatus.Unavailable: return 'bg-yellow-100 text-yellow-800';
            case ServiceStatus.Retired: return 'bg-red-100 text-red-800';
            default: return 'bg-gray-100 text-gray-800';
        }
    };

    return (
        <div>
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-3xl font-bold text-gray-800">Service Management</h1>
                <button onClick={handleOpenModalForAdd} className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors">
                    Add Service
                </button>
            </div>

            <div className="bg-white shadow-md rounded-lg overflow-hidden border border-gray-200">
                <div className="overflow-x-auto max-h-[calc(100vh-200px)] overflow-y-auto">
                    <table className="min-w-full text-sm">
                        <thead className="bg-blue-600 sticky top-0 z-10">
                            <tr>
                                <th scope="col" className="px-4 py-4 text-left text-sm font-bold text-white uppercase tracking-wider border-b-2 border-blue-700" style={{maxWidth: '180px'}}>Service Name</th>
                                <th scope="col" className="px-6 py-4 text-left text-sm font-bold text-white uppercase tracking-wider border-b-2 border-blue-700">Type</th>
                                <th scope="col" className="px-6 py-4 text-left text-sm font-bold text-white uppercase tracking-wider border-b-2 border-blue-700">Country</th>
                                <th scope="col" className="px-6 py-4 text-left text-sm font-bold text-white uppercase tracking-wider border-b-2 border-blue-700">City</th>
                                <th scope="col" className="px-6 py-4 text-left text-sm font-bold text-white uppercase tracking-wider border-b-2 border-blue-700">Min Charge</th>
                                <th scope="col" className="px-6 py-4 text-left text-sm font-bold text-white uppercase tracking-wider border-b-2 border-blue-700">Price</th>
                                <th scope="col" className="px-6 py-4 text-left text-sm font-bold text-white uppercase tracking-wider border-b-2 border-blue-700">Pricing Basis</th>
                                <th scope="col" className="px-6 py-4 text-left text-sm font-bold text-white uppercase tracking-wider border-b-2 border-blue-700">Period</th>
                                   <th scope="col" className="px-6 py-4 text-left text-sm font-bold text-white uppercase tracking-wider border-b-2 border-blue-700">Effective Date</th>
                                <th scope="col" className="px-6 py-4 text-left text-sm font-bold text-white uppercase tracking-wider border-b-2 border-blue-700">Status</th>
                                <th scope="col" className="px-6 py-4 text-left text-sm font-bold text-white uppercase tracking-wider border-b-2 border-blue-700">Last Modified</th>
                                <th scope="col" className="px-6 py-4 text-right text-sm font-bold text-white uppercase tracking-wider border-b-2 border-blue-700">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                {isLoading ? (
                    <tr><td colSpan={10} className="text-center py-10 text-gray-500">Loading services...</td></tr>
                ) : services.length === 0 ? (
                    <tr><td colSpan={10} className="text-center py-10 text-gray-500">No services found.</td></tr>
                            ) : (
                                services.map((service) => (
                                    <tr key={service.id}>
                                        <td className="px-4 py-4" style={{maxWidth: '180px'}}>
                                            <div className="font-medium text-gray-900 overflow-hidden" style={{
                                                display: '-webkit-box',
                                                WebkitLineClamp: 2,
                                                WebkitBoxOrient: 'vertical',
                                                lineHeight: '1.4em',
                                                maxHeight: '2.8em'
                                            }}>{service.name}</div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-gray-700">{service.type}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-gray-700">{service.country || 'N/A'}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-gray-700">{service.location || 'N/A'}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-gray-700">
                                            {new Intl.NumberFormat('de-DE', { style: 'currency', currency: service.currency }).format((service.minChargeAmount ?? 0))}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap font-medium text-gray-900">
                                            {new Intl.NumberFormat('de-DE', { style: 'currency', currency: service.currency }).format(service.price)}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-gray-700">{service.pricingBasis || 'Distance (km)'}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-gray-700">{(service as any).period || 'N/A'}</td>
                                           <td className="px-6 py-4 whitespace-nowrap text-gray-700">
                                               {service.effectiveDate ? new Date(service.effectiveDate).toLocaleDateString() : 'N/A'}
                                           </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(service.status)}`}>
                                                {service.status}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-gray-500">
                                            {new Date(service.lastModifiedAt).toLocaleString()}
                                            <div className="text-xs text-gray-400">by {service.lastModifiedBy}</div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right font-medium">
                                                                                        <button
                                                                                            className="px-2 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 mr-2"
                                                                                            onClick={() => handleOpenModalForEdit(service)}
                                                                                        >Edit</button>
                                                                                        <button
                                                                                            className="px-2 py-1 bg-red-500 text-white rounded hover:bg-red-600"
                                                                                            onClick={() => handleDeleteService(service.id)}
                                                                                        >Delete</button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {isModalOpen && (
                <div className="fixed inset-0 bg-black bg-opacity-50 z-40 flex justify-center items-center p-4">
                    <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-lg max-h-full overflow-y-auto">
                        <h2 className="text-2xl font-bold mb-6 text-gray-800">{editingService ? 'Edit Service' : 'Add New Service'}</h2>
                        <form onSubmit={handleSaveService}>
                             <div className="sm:col-span-2 mb-4">
                                <label htmlFor="name" className="block text-sm font-medium text-gray-700">Service Name</label>
                                <input type="text" name="name" id="name" value={formData.name} onChange={handleInputChange} className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500" required />
                            </div>
                             <div className="sm:col-span-2 mb-4">
                                <label htmlFor="description" className="block text-sm font-medium text-gray-700">Description</label>
                                <textarea name="description" id="description" value={formData.description} onChange={handleInputChange} rows={3} className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500"></textarea>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                                                                {currentUser?.role === UserRole.Administrator && (
                                                                    <div className="sm:col-span-2">
                                                                        <label className="block text-sm font-medium text-gray-700">Tenant</label>
                                                                        <select
                                                                            value={selectedTenantId}
                                                                            onChange={(e) => setSelectedTenantId(e.target.value)}
                                                                            className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                                                                        >
                                                                            {Object.entries(TENANT_FEATURE_MAP).map(([id, cfg]) => (
                                                                                <option key={id} value={id}>{cfg.label}</option>
                                                                            ))}
                                                                        </select>
                                                                        <p className="text-xs text-gray-500 mt-1">Assign this service to a tenant</p>
                                                                    </div>
                                                                )}
                                <div>
                                    <label htmlFor="type" className="block text-sm font-medium text-gray-700">Service Type</label>
                                    <div className="mt-1 flex items-center gap-2">
                                        <select name="type" id="type" value={formData.type} onChange={handleInputChange} className="flex-grow w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500">
                                            {serviceTypes.map(type => <option key={type} value={type}>{type}</option>)}
                                        </select>
                                        <button type="button" onClick={() => setIsAddTypeModalOpen(true)} className="px-3 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 text-sm">Add New</button>
                                    </div>
                                </div>
                                <div>
                                    <label htmlFor="country" className="block text-sm font-medium text-gray-700">Country</label>
                                    <select 
                                        name="country" 
                                        id="country" 
                                        value={formData.country} 
                                        onChange={handleInputChange} 
                                        className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                                        required
                                    >
                                        <option value="">Select Country...</option>
                                        {countries.map((country, idx) => <option key={idx} value={country}>{country}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label htmlFor="location" className="block text-sm font-medium text-gray-700">Location (City)</label>
                                    <select 
                                        name="location" 
                                        id="location" 
                                        value={formData.location} 
                                        onChange={handleInputChange}
                                        disabled={!formData.country || filteredCities.length === 0}
                                        className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 disabled:bg-gray-100"
                                        required
                                    >
                                        <option value="">{!formData.country ? 'Select country first...' : 'Select City...'}</option>
                                        {filteredCities.map(city => <option key={city} value={city}>{city}</option>)}
                                    </select>
                                </div>
                                   <div>
                                       <label htmlFor="effectiveDate" className="block text-sm font-medium text-gray-700">Effective Date</label>
                                       <input type="date" name="effectiveDate" id="effectiveDate" value={formData.effectiveDate} onChange={handleInputChange} className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500" required />
                                   </div>
                                <div>
                                    <label htmlFor="price" className="block text-sm font-medium text-gray-700">Price</label>
                                    <input type="number" name="price" id="price" value={formData.price} onChange={handleInputChange} step="0.01" className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500" required />
                                </div>
                                <div>
                                    <label htmlFor="pricingBasis" className="block text-sm font-medium text-gray-700">Pricing Basis</label>
                                    <select name="pricingBasis" id="pricingBasis" value={formData.pricingBasis} onChange={handleInputChange} className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500" required>
                                        <option value="Distance (km)">Distance (Km)</option>
                                        <option value="Time (hour)">Time (Hrs)</option>
                                        <option value="Fixed Fee">Fixed Fee</option>
                                    </select>
                                </div>
                                {formData.pricingBasis === 'Fixed Fee' && (
                                  <div>
                                    <label htmlFor="period" className="block text-sm font-medium text-gray-700">Period <span className="text-red-500">*</span></label>
                                    <select name="period" id="period" value={(formData as any).period} onChange={handleInputChange} className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500" required>
                                        <option value="">Select Period...</option>
                                        <option value="Daily">Daily</option>
                                        <option value="Weekly">Weekly</option>
                                        <option value="Monthly">Monthly</option>
                                        <option value="Quarterly">Quarterly</option>
                                        <option value="Annual">Annual</option>
                                        <option value="one-off">one-off</option>
                                        <option value="Waived">Waived</option>
                                    </select>
                                  </div>
                                )}
                                <div>
                                    <label htmlFor="minChargeAmount" className="block text-sm font-medium text-gray-700">Minimum Charge Amount (optional)</label>
                                    <input type="number" name="minChargeAmount" id="minChargeAmount" value={(formData as any).minChargeAmount} onChange={handleInputChange} step="0.01" className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500" />
                                </div>
                                <div>
                                    <label htmlFor="currency" className="block text-sm font-medium text-gray-700">Currency</label>
                                    <input type="text" name="currency" id="currency" value={formData.currency} onChange={handleInputChange} placeholder="EUR" className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500" required />
                                </div>
                                 <div className="sm:col-span-2">
                                    <label htmlFor="status" className="block text-sm font-medium text-gray-700">Status</label>
                                    <select name="status" id="status" value={formData.status} onChange={handleInputChange} className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500">
                                        {Object.values(ServiceStatus).map(status => <option key={status} value={status}>{status}</option>)}
                                    </select>
                                </div>
                            </div>
                            <div className="mt-8 flex justify-end space-x-4">
                                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300">Cancel</button>
                                <button type="submit" className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700">{editingService ? 'Save Changes' : 'Save Service'}</button>
                            </div>
                        </form>
                    </div>
                    {isAddTypeModalOpen && (
                        <div className="fixed inset-0 bg-black bg-opacity-70 z-50 flex justify-center items-center p-4">
                            <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-sm">
                                <h3 className="text-lg font-bold mb-4 text-gray-800">Add New Service Type</h3>
                                <div>
                                    <label htmlFor="newTypeName" className="block text-sm font-medium text-gray-700 mb-1">Type Name</label>
                                    <input 
                                        type="text" 
                                        id="newTypeName" 
                                        value={newTypeName} 
                                        onChange={(e) => setNewTypeName(e.target.value)} 
                                        className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500" 
                                        placeholder="e.g. Ferry" 
                                    />
                                </div>
                                <div className="mt-6 flex justify-end space-x-3">
                                    <button type="button" onClick={() => setIsAddTypeModalOpen(false)} className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300">Cancel</button>
                                    <button type="button" onClick={handleSaveNewType} className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700">Save Type</button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default ServiceManager;