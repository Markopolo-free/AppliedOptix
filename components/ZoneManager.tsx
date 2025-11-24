import React, { useState, useEffect, useCallback } from 'react';
import { ref, get, push, set, serverTimestamp, update, remove, onValue, getDatabase } from 'firebase/database';
import { db } from '../services/firebase';
import { Zone } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { logAudit, calculateChanges } from '../services/auditService';

const initialNewZoneState = {
    name: '',
    type: '',
    country: '',
    location: '',
};

const ZoneManager: React.FC = () => {
    const { currentUser, isAdmin } = useAuth();
    const [zones, setZones] = useState<Zone[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [newZone, setNewZone] = useState(initialNewZoneState);
    const [editingZone, setEditingZone] = useState<Zone | null>(null);
    const [countries, setCountries] = useState<string[]>([]);
    const [cities, setCities] = useState<Array<{ id: string; name: string; country: string; population: number }>>([]);
    const [filteredCities, setFilteredCities] = useState<string[]>([]);
    const [zoneTypes, setZoneTypes] = useState<Array<{ id: string; name: string }>>([]);

    // Fetch countries from reference data
    useEffect(() => {
        const database = getDatabase();
        const countriesRef = ref(database, 'referenceCountries');
        const unsubscribe = onValue(countriesRef, (snapshot) => {
            const data = snapshot.val();
            if (data) {
                const countriesArray = Object.values(data).map((country: any) => country.name);
                countriesArray.sort((a: string, b: string) => a.localeCompare(b));
                setCountries(countriesArray);
            } else {
                setCountries([]);
            }
        });
        return () => unsubscribe();
    }, []);

    // Fetch zone types from reference data
    useEffect(() => {
        const database = getDatabase();
        const zoneTypesRef = ref(database, 'referenceZoneTypes');
        const unsubscribe = onValue(zoneTypesRef, (snapshot) => {
            const data = snapshot.val();
            if (data) {
                const typesArray = Object.entries(data).map(([id, type]: [string, any]) => ({
                    id,
                    name: type.name
                }));
                typesArray.sort((a, b) => a.name.localeCompare(b.name));
                setZoneTypes(typesArray);
            } else {
                setZoneTypes([]);
            }
        });
        return () => unsubscribe();
    }, []);

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
                    country: city.country || '',
                    population: city.population
                }));
                // Sort by population (descending)
                citiesArray.sort((a, b) => b.population - a.population);
                setCities(citiesArray);
            }
        });

        return () => unsubscribe();
    }, []);

    // Filter cities by selected country
    useEffect(() => {
        if (!newZone.country) {
            setFilteredCities([]);
            return;
        }
        const filtered = cities
            .filter(city => {
                // Match by exact country
                if (city.country === newZone.country) return true;
                // Legacy support: Include cities with empty country if selecting Germany
                if (!city.country && newZone.country === 'Germany') return true;
                return false;
            })
            .map(city => city.name);
        setFilteredCities(filtered);
    }, [newZone.country, cities]);

    const fetchZones = useCallback(async () => {
        setIsLoading(true);
        try {
            const zonesRef = ref(db, 'referenceZones');
            const snapshot = await get(zonesRef);
            if (snapshot.exists()) {
                const data = snapshot.val();
                // Safely coerce timestamps coming from RTDB to a valid ISO string
                const toISOOrFallback = (value: any): string => {
                    if (value !== undefined && value !== null) {
                        const d = new Date(value);
                        if (!isNaN(d.getTime())) return d.toISOString();
                    }
                    // Try common alternate fields if present
                    return new Date(0).toISOString(); // fallback to epoch to avoid crashes
                };

                const zonesList: Zone[] = Object.keys(data).map(key => {
                    const raw = data[key];
                    const lastModifiedISO = toISOOrFallback(raw.lastModifiedAt ?? raw.updatedAt ?? raw.createdAt);
                    return {
                        id: key,
                        ...raw,
                        lastModifiedAt: lastModifiedISO,
                    } as Zone;
                });
                // Sort by Location (alphabetical), then by Type (alphabetical), then by Zone Name
                zonesList.sort((a, b) => {
                    const locationCompare = a.location.localeCompare(b.location);
                    if (locationCompare !== 0) return locationCompare;
                    const typeCompare = a.type.localeCompare(b.type);
                    if (typeCompare !== 0) return typeCompare;
                    return a.name.localeCompare(b.name);
                });
                setZones(zonesList);
            } else {
                setZones([]);
            }
        } catch (error) {
            console.error("Error fetching zones: ", error);
            alert("Could not fetch zones. See console for details.");
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchZones();
    }, [fetchZones]);

    const handleOpenModalForAdd = () => {
        if (!isAdmin) {
            alert('Only Administrators can add new Pricing Zones.');
            return;
        }
        setEditingZone(null);
        setNewZone(initialNewZoneState);
        setFilteredCities([]);
        setIsModalOpen(true);
    };

    const handleOpenModalForEdit = (zone: Zone) => {
        setEditingZone(zone);
        setNewZone({
            name: zone.name,
            type: zone.type,
            country: zone.country || '',
            location: zone.location,
        });
        // Pre-filter cities for the zone's country
        const filtered = cities
            .filter(city => {
                if (city.country === zone.country) return true;
                if (!city.country && zone.country === 'Germany') return true;
                return false;
            })
            .map(city => city.name);
        setFilteredCities(filtered);
        setIsModalOpen(true);
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setNewZone(prev => ({ ...prev, [name]: value }));
    };

    const handleSaveZone = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newZone.name || !newZone.country || !newZone.location) {
            alert("Please fill in all fields.");
            return;
        }
        if (!editingZone && !isAdmin) {
            alert('Only Administrators can add new Pricing Zones.');
            return;
        }
        try {
            const modifiedBy = currentUser?.name || currentUser?.email || 'Unknown User';

            if (editingZone) {
                const zoneRef = ref(db, `referenceZones/${editingZone.id}`);
                await update(zoneRef, {
                    ...newZone,
                    lastModifiedBy: modifiedBy,
                    lastModifiedAt: serverTimestamp(),
                });

                // Log audit for update
                if (currentUser) {
                    const changes = calculateChanges(
                        { name: editingZone.name, type: editingZone.type, country: editingZone.country, location: editingZone.location },
                        newZone
                    );
                    await logAudit({
                        userId: currentUser.email,
                        userName: currentUser.name,
                        userEmail: currentUser.email,
                        action: 'update',
                        entityType: 'zone',
                        entityId: editingZone.id,
                        entityName: newZone.name,
                        changes,
                    });
                }
            } else {
                const zonesListRef = ref(db, 'referenceZones');
                const newZoneRef = push(zonesListRef);
                await set(newZoneRef, {
                    ...newZone,
                    lastModifiedBy: modifiedBy,
                    lastModifiedAt: serverTimestamp(),
                });

                // Log audit for create
                if (currentUser) {
                    await logAudit({
                        userId: currentUser.email,
                        userName: currentUser.name,
                        userEmail: currentUser.email,
                        action: 'create',
                        entityType: 'zone',
                        entityId: newZoneRef.key || '',
                        entityName: newZone.name,
                    });
                }
            }
            setIsModalOpen(false);
            setEditingZone(null);
            await fetchZones();
        } catch (error) {
            console.error("Error saving zone: ", error);
            alert("Failed to save zone. See console for details.");
        }
    };    const handleDeleteZone = async (zoneId: string) => {
        if(window.confirm('Are you sure you want to delete this zone?')) {
            try {
                // Get zone details before deletion for audit log
                const zoneToDelete = zones.find(z => z.id === zoneId);

                await remove(ref(db, `referenceZones/${zoneId}`));

                // Log audit for delete
                if (currentUser && zoneToDelete) {
                    await logAudit({
                        userId: currentUser.email,
                        userName: currentUser.name,
                        userEmail: currentUser.email,
                        action: 'delete',
                        entityType: 'zone',
                        entityId: zoneId,
                        entityName: zoneToDelete.name,
                    });
                }
                
                await fetchZones();
            } catch (error) {
                console.error("Error deleting zone:", error);
                alert("Failed to delete zone.");
            }
        }
    };

    return (
        <div>
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-3xl font-bold text-gray-800">Pricing Zone Management</h1>
                <button 
                    onClick={handleOpenModalForAdd} 
                    disabled={!isAdmin}
                    className={`px-4 py-2 rounded-lg transition-colors ${
                        isAdmin 
                            ? 'bg-primary-600 text-white hover:bg-primary-700' 
                            : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    }`}
                    title={!isAdmin ? 'Only Administrators can add zones' : 'Add a new pricing zone'}
                >
                    Add Zone
                </button>
            </div>

            <div className="bg-white shadow-md rounded-lg overflow-hidden border border-gray-200">
                <div className="overflow-x-auto max-h-[calc(100vh-200px)] overflow-y-auto">
                    <table className="min-w-full text-sm">
                        <thead className="bg-blue-600 sticky top-0 z-10">
                            <tr>
                                <th scope="col" className="px-6 py-4 text-left text-sm font-bold text-white uppercase tracking-wider border-b-2 border-blue-700">Country</th>
                                <th scope="col" className="px-6 py-4 text-left text-sm font-bold text-white uppercase tracking-wider border-b-2 border-blue-700">City</th>
                                <th scope="col" className="px-6 py-4 text-left text-sm font-bold text-white uppercase tracking-wider border-b-2 border-blue-700">Type</th>
                                <th scope="col" className="px-6 py-4 text-left text-sm font-bold text-white uppercase tracking-wider border-b-2 border-blue-700">Zone Name</th>
                                <th scope="col" className="px-6 py-4 text-left text-sm font-bold text-white uppercase tracking-wider border-b-2 border-blue-700">Last Modified</th>
                                <th scope="col" className="px-6 py-4 text-right text-sm font-bold text-white uppercase tracking-wider border-b-2 border-blue-700">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                             {isLoading ? (
                                <tr><td colSpan={6} className="text-center py-10 text-gray-500">Loading zones from Realtime Database...</td></tr>
                            ) : zones.length === 0 ? (
                                <tr><td colSpan={6} className="text-center py-10 text-gray-500">No zones found in database.</td></tr>
                            ) : (
                                zones.map((zone) => (
                                    <tr key={zone.id}>
                                        <td className="px-6 py-4 whitespace-nowrap font-medium text-gray-900">{zone.country || '—'}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-gray-700">{zone.location}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-gray-700">{zone.type}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-gray-700">{zone.name}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-gray-500">
                                            {new Date(zone.lastModifiedAt).toLocaleString()}
                                            <div className="text-xs text-gray-400">by {zone.lastModifiedBy}</div>
                                        </td>
                                                                                <td className="px-6 py-4 whitespace-nowrap text-right font-medium">
                                                                                        <button
                                                                                            className="px-2 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 mr-2"
                                                                                            onClick={() => handleOpenModalForEdit(zone)}
                                                                                        >Edit</button>
                                                                                        <button
                                                                                            className="px-2 py-1 bg-red-500 text-white rounded hover:bg-red-600"
                                                                                            onClick={() => handleDeleteZone(zone.id)}
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
                    <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-md">
                        <h2 className="text-2xl font-bold mb-6 text-gray-800">{editingZone ? 'Edit Pricing Zone' : 'Add New Pricing Zone'}</h2>
                        <form onSubmit={handleSaveZone}>
                            <div className="mb-4">
                                <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">Zone Name</label>
                                <input type="text" id="name" name="name" value={newZone.name} onChange={handleInputChange} className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500" required />
                            </div>
                            <div className="mb-4">
                                <label htmlFor="country" className="block text-sm font-medium text-gray-700 mb-1">Country</label>
                                <select 
                                    id="country" 
                                    name="country" 
                                    value={newZone.country} 
                                    onChange={handleInputChange} 
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500" 
                                    required
                                >
                                    <option value="">Select Country...</option>
                                    {countries.map((country) => (
                                        <option key={country} value={country}>
                                            {country}
                                        </option>
                                    ))}
                                </select>
                                {countries.length === 0 && (
                                    <p className="mt-1 text-sm text-gray-500">
                                        No countries available. Add countries in Reference Data first.
                                    </p>
                                )}
                            </div>
                             <div className="mb-4">
                                <label htmlFor="location" className="block text-sm font-medium text-gray-700 mb-1">City</label>
                                <select 
                                    id="location" 
                                    name="location" 
                                    value={newZone.location} 
                                    onChange={handleInputChange} 
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500" 
                                    required
                                    disabled={!newZone.country || filteredCities.length === 0}
                                >
                                    <option value="">{!newZone.country ? 'Select country first...' : 'Select City...'}</option>
                                    {filteredCities.map((cityName) => (
                                        <option key={cityName} value={cityName}>
                                            {cityName}
                                        </option>
                                    ))}
                                </select>
                                {newZone.country && filteredCities.length === 0 && (
                                    <p className="mt-1 text-sm text-gray-500">
                                        No cities available for this country. Add cities in Reference Data first.
                                    </p>
                                )}
                            </div>
                            <div className="mb-6">
                                <label htmlFor="type" className="block text-sm font-medium text-gray-700 mb-1">Zone Type</label>
                                <select 
                                    id="type" 
                                    name="type" 
                                    value={newZone.type} 
                                    onChange={handleInputChange} 
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                                    required
                                >
                                    <option value="">Select zone type...</option>
                                    {zoneTypes.map(type => (
                                        <option key={type.id} value={type.name}>
                                            {type.name}
                                        </option>
                                    ))}
                                </select>
                                {zoneTypes.length === 0 && (
                                    <p className="mt-1 text-sm text-gray-500">
                                        No zone types available. Add zone types in Reference Data first.
                                    </p>
                                )}
                            </div>
                            <div className="flex justify-end space-x-4">
                                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300">Cancel</button>
                                <button type="submit" className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700">{editingZone ? 'Save Changes' : 'Save Zone'}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ZoneManager;