import React, { useState, useEffect, useCallback } from 'react';
import { ref, get, push, set, serverTimestamp, update, remove } from 'firebase/database';
import { db } from '../services/firebase';
import { PricingRule, PricingBasis, UserGroup, Zone, Service, ApprovalStatus, UserRole, ServiceTypeEntry } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { logAudit, calculateChanges } from '../services/auditService';

interface ServiceTypeOption {
    id: string; // unique key: serviceTypeId or serviceTypeId-provider-model
    serviceTypeId: string;
    serviceTypeName: string;
    provider?: string;
    model?: string;
}

const initialNewRuleState = {
    description: '',
    serviceIds: [] as string[],
    serviceTypeEntries: [] as ServiceTypeEntry[],
    basis: PricingBasis.Distance,
    rate: '',
    userGroup: UserGroup.Standard,
    minimumUsage: '',
    zoneId: '',
    zoneDiscount: '',
};

const PricingManager: React.FC = () => {
    const { currentUser } = useAuth();
    const [rules, setRules] = useState<PricingRule[]>([]);
    const [zones, setZones] = useState<Zone[]>([]); // For dropdowns and display
    const [selectedLocation, setSelectedLocation] = useState<string>('');
    const [selectedZoneType, setSelectedZoneType] = useState<string>('');
    const [services, setServices] = useState<Service[]>([]); // For multi-select/info (legacy)
    const [serviceTypeOptions, setServiceTypeOptions] = useState<ServiceTypeOption[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [formData, setFormData] = useState(initialNewRuleState);
    const [editingRule, setEditingRule] = useState<PricingRule | null>(null);
    
    const isMaker = currentUser?.role === UserRole.Maker || currentUser?.role === UserRole.Administrator;
    const isChecker = currentUser?.role === UserRole.Checker || currentUser?.role === UserRole.Administrator;

    const fetchData = useCallback(async () => {
        setIsLoading(true);
        try {
            // Fetch pricing rules
            const rulesRef = ref(db, 'pricingRules');
            const rulesSnapshot = await get(rulesRef);
            if (rulesSnapshot.exists()) {
                const data = rulesSnapshot.val();
                const list: PricingRule[] = Object.keys(data).map(key => ({
                    id: key,
                    ...data[key],
                    serviceIds: data[key].serviceIds || [],
                    lastModifiedAt: new Date(data[key].lastModifiedAt).toISOString(),
                }));
                // Sort by service type name alphabetically
                list.sort((a, b) => {
                    const aServiceType = (a.serviceTypeEntries && a.serviceTypeEntries.length > 0)
                        ? a.serviceTypeEntries[0].serviceTypeName
                        : '';
                    const bServiceType = (b.serviceTypeEntries && b.serviceTypeEntries.length > 0)
                        ? b.serviceTypeEntries[0].serviceTypeName
                        : '';
                    return aServiceType.localeCompare(bServiceType);
                });
                setRules(list);
            } else {
                setRules([]);
            }

            // Fetch zones for dropdown from reference data
            const zonesRef = ref(db, 'referenceZones');
            const zonesSnapshot = await get(zonesRef);
            if (zonesSnapshot.exists()) {
                const data = zonesSnapshot.val();
                const list: Zone[] = Object.keys(data).map(key => ({ id: key, ...data[key] }));
                setZones(list);
            }

            // Fetch services for reference (legacy)
            const servicesRef = ref(db, 'services');
            const servicesSnapshot = await get(servicesRef);
            if (servicesSnapshot.exists()) {
                const data = servicesSnapshot.val();
                const list: Service[] = Object.keys(data).map(key => ({ id: key, ...data[key] }));
                setServices(list);
            }

            // Fetch service types from reference data and expand with providers
            const serviceTypesRef = ref(db, 'referenceServiceTypes');
            const serviceTypesSnapshot = await get(serviceTypesRef);
            const options: ServiceTypeOption[] = [];
            
            if (serviceTypesSnapshot.exists()) {
                const data = serviceTypesSnapshot.val();
                console.log('Service types data:', data);
                
                Object.keys(data).forEach(key => {
                    const serviceType = data[key];
                    const providers = serviceType.providers || [];
                    
                    if (providers.length > 0) {
                        // Expand each provider/model combination into a separate row
                        providers.forEach((p: { name: string; model?: string }) => {
                            const uniqueId = `${key}-${p.name}-${p.model || 'default'}`;
                            options.push({
                                id: uniqueId,
                                serviceTypeId: key,
                                serviceTypeName: serviceType.name,
                                provider: p.name,
                                model: p.model
                            });
                        });
                    } else {
                        // Service type without providers
                        options.push({
                            id: key,
                            serviceTypeId: key,
                            serviceTypeName: serviceType.name
                        });
                    }
                });
                
                // Sort by service type name, then provider, then model
                options.sort((a, b) => {
                    const nameCompare = a.serviceTypeName.localeCompare(b.serviceTypeName);
                    if (nameCompare !== 0) return nameCompare;
                    const providerCompare = (a.provider || '').localeCompare(b.provider || '');
                    if (providerCompare !== 0) return providerCompare;
                    return (a.model || '').localeCompare(b.model || '');
                });
            } else {
                console.log('No service types found in referenceServiceTypes');
            }
            
            console.log(`Loaded ${options.length} service type options:`, options);
            setServiceTypeOptions(options);

        } catch (error) {
            console.error("Error fetching data:", error);
            alert("Could not fetch pricing data. See console for details.");
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const handleOpenModalForAdd = () => {
        setEditingRule(null);
        setFormData(initialNewRuleState);
        setSelectedLocation('');
        setSelectedZoneType('');
        setIsModalOpen(true);
    };

    const handleOpenModalForEdit = (rule: PricingRule) => {
        setEditingRule(rule);
        setFormData({
            description: rule.description,
            serviceIds: rule.serviceIds || [],
            serviceTypeEntries: rule.serviceTypeEntries || [],
            basis: rule.basis,
            rate: String(rule.rate),
            userGroup: rule.userGroup,
            minimumUsage: rule.minimumUsage ? String(rule.minimumUsage) : '',
            zoneId: rule.zoneId || '',
            zoneDiscount: rule.zoneDiscount ? String(rule.zoneDiscount) : '',
        });
        // Pre-fill location and type if zone is selected
        if (rule.zoneId) {
            const z = zones.find(zz => zz.id === rule.zoneId);
            if (z) {
                setSelectedLocation(z.location);
                setSelectedZoneType(z.type);
            }
        } else {
            setSelectedLocation('');
            setSelectedZoneType('');
        }
        setIsModalOpen(true);
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleServiceSelectionChange = (serviceId: string) => {
        setFormData(prev => {
            const currentServiceIds = prev.serviceIds || [];
            const newServiceIds = currentServiceIds.includes(serviceId)
                ? currentServiceIds.filter(id => id !== serviceId)
                : [...currentServiceIds, serviceId];
            return { ...prev, serviceIds: newServiceIds };
        });
    };

    const handleServiceTypeSelectionChange = (option: ServiceTypeOption) => {
        setFormData(prev => {
            const currentEntries = prev.serviceTypeEntries || [];
            const exists = currentEntries.some(e =>
                e.serviceTypeId === option.serviceTypeId &&
                e.provider === option.provider &&
                e.model === option.model
            );
            
            const newEntries = exists
                ? currentEntries.filter(e =>
                    !(e.serviceTypeId === option.serviceTypeId &&
                      e.provider === option.provider &&
                      e.model === option.model)
                  )
                : [...currentEntries, {
                    serviceTypeId: option.serviceTypeId,
                    serviceTypeName: option.serviceTypeName,
                    ...(option.provider && { provider: option.provider }),
                    ...(option.model && { model: option.model })
                  }];
            
            return { ...prev, serviceTypeEntries: newEntries };
        });
    };

    const handleSaveRule = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!isMaker) {
            alert("Only Makers or Administrators can create or edit pricing rules.");
            return;
        }

        if ((!formData.serviceTypeEntries || formData.serviceTypeEntries.length === 0) &&
            (!formData.serviceIds || formData.serviceIds.length === 0)) {
            alert("Please select at least one service or service type for the rule.");
            return;
        }

        const userName = currentUser?.name || currentUser?.email || 'Unknown User';
        const userEmail = currentUser?.email || '';

        // Clean service type entries to remove undefined values
        const cleanedServiceTypeEntries = (formData.serviceTypeEntries || []).map(entry => {
            const cleaned: ServiceTypeEntry = {
                serviceTypeId: entry.serviceTypeId,
                serviceTypeName: entry.serviceTypeName
            };
            if (entry.provider) cleaned.provider = entry.provider;
            if (entry.model) cleaned.model = entry.model;
            return cleaned;
        });

        const ruleData = {
            description: formData.description,
            serviceIds: formData.serviceIds || [],
            serviceTypeEntries: cleanedServiceTypeEntries,
            basis: formData.basis,
            rate: parseFloat(formData.rate) || 0,
            userGroup: formData.userGroup,
            minimumUsage: formData.minimumUsage ? parseFloat(formData.minimumUsage) : null,
            zoneId: formData.zoneId || null,
            zoneDiscount: formData.zoneDiscount ? parseFloat(formData.zoneDiscount) : null,
            status: ApprovalStatus.Pending,
            makerName: userName,
            makerEmail: userEmail,
            makerTimestamp: new Date().toISOString(),
            lastModifiedBy: userName,
            lastModifiedAt: serverTimestamp(),
        };

        try {
            if (editingRule) {
                const ruleRef = ref(db, `pricingRules/${editingRule.id}`);
                await update(ruleRef, ruleData);

                // Log audit for update
                if (currentUser) {
                    const changes = calculateChanges(editingRule, ruleData);
                    await logAudit({
                        userId: currentUser.email,
                        userName: currentUser.name,
                        userEmail: currentUser.email,
                        action: 'update',
                        entityType: 'pricing',
                        entityId: editingRule.id,
                        entityName: ruleData.description,
                        changes,
                    });
                }
            } else {
                const rulesListRef = ref(db, 'pricingRules');
                const newRuleRef = push(rulesListRef);
                await set(newRuleRef, ruleData);

                // Log audit for create
                if (currentUser) {
                    await logAudit({
                        userId: currentUser.email,
                        userName: currentUser.name,
                        userEmail: currentUser.email,
                        action: 'create',
                        entityType: 'pricing',
                        entityId: newRuleRef.key || '',
                        entityName: ruleData.description,
                    });
                }
            }
            setIsModalOpen(false);
            setEditingRule(null);
            await fetchData();
            alert("Rule saved as Pending. Awaiting Checker approval.");
        } catch (error) {
            console.error("Error saving pricing rule:", error);
            alert("Failed to save pricing rule. See console for details.");
        }
    };

    const handleApproveRule = async (rule: PricingRule) => {
        if (!isChecker) {
            alert("Only Checkers or Administrators can approve pricing rules.");
            return;
        }

        if (rule.makerEmail === currentUser?.email) {
            alert("You cannot approve your own changes. A different Checker must approve.");
            return;
        }

        const userName = currentUser?.name || currentUser?.email || 'Unknown User';
        const userEmail = currentUser?.email || '';

        try {
            const ruleRef = ref(db, `pricingRules/${rule.id}`);
            await update(ruleRef, {
                status: ApprovalStatus.Approved,
                checkerName: userName,
                checkerEmail: userEmail,
                checkerTimestamp: new Date().toISOString(),
                lastModifiedBy: userName,
                lastModifiedAt: serverTimestamp(),
            });

            // Log audit for approve
            if (currentUser) {
                await logAudit({
                    userId: currentUser.email,
                    userName: currentUser.name,
                    userEmail: currentUser.email,
                    action: 'approve',
                    entityType: 'pricing',
                    entityId: rule.id,
                    entityName: rule.description,
                    metadata: { previousStatus: rule.status, newStatus: ApprovalStatus.Approved },
                });
            }

            await fetchData();
            alert("Rule approved successfully!");
        } catch (error) {
            console.error("Error approving rule:", error);
            alert("Failed to approve rule. See console for details.");
        }
    };

    const handleRejectRule = async (rule: PricingRule) => {
        if (!isChecker) {
            alert("Only Checkers or Administrators can reject pricing rules.");
            return;
        }

        if (rule.makerEmail === currentUser?.email) {
            alert("You cannot reject your own changes. A different Checker must review.");
            return;
        }

        const userName = currentUser?.name || currentUser?.email || 'Unknown User';
        const userEmail = currentUser?.email || '';

        try {
            const ruleRef = ref(db, `pricingRules/${rule.id}`);
            await update(ruleRef, {
                status: ApprovalStatus.Rejected,
                checkerName: userName,
                checkerEmail: userEmail,
                checkerTimestamp: new Date().toISOString(),
                lastModifiedBy: userName,
                lastModifiedAt: serverTimestamp(),
            });

            // Log audit for reject
            if (currentUser) {
                await logAudit({
                    userId: currentUser.email,
                    userName: currentUser.name,
                    userEmail: currentUser.email,
                    action: 'reject',
                    entityType: 'pricing',
                    entityId: rule.id,
                    entityName: rule.description,
                    metadata: { previousStatus: rule.status, newStatus: ApprovalStatus.Rejected },
                });
            }

            await fetchData();
            alert("Rule rejected.");
        } catch (error) {
            console.error("Error rejecting rule:", error);
            alert("Failed to reject rule. See console for details.");
        }
    };
    
    const handleDeleteRule = async (ruleId: string) => {
        if (window.confirm('Are you sure you want to delete this pricing rule?')) {
            try {
                // Get rule details before deletion for audit log
                const ruleToDelete = rules.find(r => r.id === ruleId);
                
                await remove(ref(db, `pricingRules/${ruleId}`));
                
                // Log audit for delete
                if (currentUser && ruleToDelete) {
                    await logAudit({
                        userId: currentUser.email,
                        userName: currentUser.name,
                        userEmail: currentUser.email,
                        action: 'delete',
                        entityType: 'pricing',
                        entityId: ruleId,
                        entityName: ruleToDelete.description,
                    });
                }
                
                await fetchData();
            } catch (error) {
                console.error("Error deleting rule:", error);
                alert("Failed to delete pricing rule.");
            }
        }
    };
    
    const getServiceName = (serviceId: string) => services.find(s => s.id === serviceId)?.name || serviceId;
    const getZoneName = (zoneId: string) => {
        const z = zones.find(zz => zz.id === zoneId);
        if (!z) return zoneId;
        // Display Location and Type from Pricing Zone Management
        return `${z.location} • ${z.type}`;
    };

    const getUniqueLocations = (): string[] => {
        const locs = Array.from(new Set(zones.map(z => z.location))) as string[];
        return locs.sort((a, b) => a.localeCompare(b));
    };
    const getTypesForLocation = (loc: string): string[] => {
        const types = zones.filter(z => !loc || z.location === loc).map(z => z.type);
        const uniqueTypes = Array.from(new Set(types)) as string[];
        return uniqueTypes.sort((a, b) => a.localeCompare(b));
    };
    
    const formatServiceTypeEntries = (entries: ServiceTypeEntry[]) => {
        if (!entries || entries.length === 0) return '';
        return entries.map(e => {
            let label = e.serviceTypeName;
            if (e.provider) {
                label += ` — ${e.provider}`;
                if (e.model) label += ` ${e.model}`;
            }
            return label;
        }).join(', ');
    };

    // Auto-update zoneId when location + type change
    useEffect(() => {
        if (!selectedLocation || !selectedZoneType) {
            // Only update if form zoneId isn't already empty
            if (formData.zoneId) {
                setFormData(prev => ({ ...prev, zoneId: '' }));
            }
            return;
        }
        const match = zones.find(z => z.location === selectedLocation && z.type === selectedZoneType);
        setFormData(prev => ({ ...prev, zoneId: match ? match.id : '' }));
    }, [selectedLocation, selectedZoneType, zones]);

    return (
        <div>
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-3xl font-bold text-gray-800">Pricing Rule Management</h1>
                <button 
                    onClick={handleOpenModalForAdd} 
                    disabled={!isMaker}
                    className={`px-4 py-2 rounded-lg transition-colors ${
                        isMaker 
                            ? 'bg-primary-600 text-white hover:bg-primary-700' 
                            : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    }`}
                    title={!isMaker ? 'Only Makers can add pricing rules' : 'Add a new pricing rule'}
                >
                    Add Rule
                </button>
            </div>

            <div className="bg-white shadow-md rounded-lg overflow-hidden border border-gray-200">
                <div className="overflow-x-auto max-h-[calc(100vh-200px)] overflow-y-auto">
                    <table className="min-w-full text-sm">
                        <thead className="bg-blue-600 sticky top-0 z-10">
                            <tr>
                                <th className="px-6 py-4 text-left text-sm font-bold text-white uppercase tracking-wider border-b-2 border-blue-700">Services</th>
                                <th className="px-6 py-4 text-left text-sm font-bold text-white uppercase tracking-wider border-b-2 border-blue-700">User Group</th>
                                <th className="px-6 py-4 text-left text-sm font-bold text-white uppercase tracking-wider border-b-2 border-blue-700">Details</th>
                                <th className="px-6 py-4 text-left text-sm font-bold text-white uppercase tracking-wider border-b-2 border-blue-700">Status</th>
                                <th className="px-6 py-4 text-left text-sm font-bold text-white uppercase tracking-wider border-b-2 border-blue-700">Maker/Checker</th>
                                <th className="px-6 py-4 text-right text-sm font-bold text-white uppercase tracking-wider border-b-2 border-blue-700">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {isLoading ? (
                                <tr><td colSpan={6} className="text-center py-10 text-gray-500">Loading pricing rules...</td></tr>
                            ) : rules.length === 0 ? (
                                <tr><td colSpan={6} className="text-center py-10 text-gray-500">No pricing rules found.</td></tr>
                            ) : (
                                rules.map((rule) => (
                                    <tr key={rule.id} className={rule.status === ApprovalStatus.Pending ? 'bg-yellow-50' : ''}>
                                        <td className="px-6 py-4 text-gray-700">
                                            {rule.serviceTypeEntries && rule.serviceTypeEntries.length > 0 ? (
                                                <div className="flex flex-col gap-1">
                                                    {rule.serviceTypeEntries.map((entry, idx) => (
                                                        <div key={idx} className="text-sm">
                                                            <div className="font-medium">{entry.serviceTypeName}</div>
                                                            {entry.provider && (
                                                                <div className="text-xs text-gray-500">
                                                                    {entry.provider}{entry.model ? ` ${entry.model}` : ''}
                                                                </div>
                                                            )}
                                                        </div>
                                                    ))}
                                                </div>
                                            ) : (
                                                <span className="text-gray-400 italic">
                                                    {rule.serviceIds && rule.serviceIds.length > 0 
                                                        ? rule.serviceIds.map(getServiceName).join(', ') 
                                                        : 'No services'}
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className="text-sm text-gray-900">{rule.userGroup}</span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="font-medium text-gray-900">€{rule.rate.toFixed(2)} / {rule.basis === PricingBasis.Distance ? 'km' : 'hr'}</div>
                                            {rule.minimumUsage && (
                                                <div className="text-gray-500">
                                                    Min: {rule.minimumUsage} {rule.basis === PricingBasis.Distance ? 'km' : 'hrs'}
                                                </div>
                                            )}
                                            {rule.zoneId && rule.zoneDiscount && <div className="text-gray-500">Zone: {getZoneName(rule.zoneId)} ({rule.zoneDiscount}% off)</div>}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                                                rule.status === ApprovalStatus.Approved ? 'bg-green-100 text-green-800' :
                                                rule.status === ApprovalStatus.Rejected ? 'bg-red-100 text-red-800' :
                                                'bg-yellow-100 text-yellow-800'
                                            }`}>
                                                {rule.status || 'Pending'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-gray-500">
                                            <div className="text-xs">
                                                <div><strong>Maker:</strong> {rule.makerName || 'N/A'}</div>
                                                {rule.makerTimestamp && <div className="text-gray-400">{new Date(rule.makerTimestamp).toLocaleString()}</div>}
                                                {rule.checkerName && (
                                                    <>
                                                        <div className="mt-1"><strong>Checker:</strong> {rule.checkerName}</div>
                                                        {rule.checkerTimestamp && <div className="text-gray-400">{new Date(rule.checkerTimestamp).toLocaleString()}</div>}
                                                    </>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right font-medium">
                                            {rule.status === ApprovalStatus.Pending && isChecker && rule.makerEmail !== currentUser?.email && (
                                                <>
                                                    <button onClick={() => handleApproveRule(rule)} className="text-green-600 hover:text-green-900 mr-2">Approve</button>
                                                    <button onClick={() => handleRejectRule(rule)} className="text-red-600 hover:text-red-900 mr-2">Reject</button>
                                                </>
                                            )}
                                            {isMaker && <button onClick={() => handleOpenModalForEdit(rule)} className="text-primary-600 hover:text-primary-900">Edit</button>}
                                            <button onClick={() => handleDeleteRule(rule.id)} className="ml-4 text-red-600 hover:text-red-900">Delete</button>
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
                        <h2 className="text-2xl font-bold mb-6 text-gray-800">{editingRule ? 'Edit Pricing Rule' : 'Add New Pricing Rule'}</h2>
                        <form onSubmit={handleSaveRule}>
                            <div className="grid grid-cols-1 gap-y-4 gap-x-4 sm:grid-cols-2">
                                <div className="sm:col-span-2">
                                    <label className="block text-sm font-medium text-gray-700">Service Types</label>
                                    <div className="mt-2 p-2 border border-gray-300 rounded-md max-h-40 overflow-y-auto">
                                        {serviceTypeOptions.length > 0 ? (
                                            serviceTypeOptions.map(option => {
                                                const isChecked = (formData.serviceTypeEntries || []).some(e =>
                                                    e.serviceTypeId === option.serviceTypeId &&
                                                    e.provider === option.provider &&
                                                    e.model === option.model
                                                );
                                                return (
                                                    <div key={option.id} className="flex items-start my-1">
                                                        <input
                                                            id={`servicetype-${option.id}`}
                                                            name="serviceTypes"
                                                            type="checkbox"
                                                            checked={isChecked}
                                                            onChange={() => handleServiceTypeSelectionChange(option)}
                                                            className="h-4 w-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500 mt-0.5"
                                                        />
                                                        <label htmlFor={`servicetype-${option.id}`} className="ml-3 text-sm text-gray-700">
                                                            <div className="font-medium">{option.serviceTypeName}</div>
                                                            {option.provider && (
                                                                <div className="text-xs text-gray-500">
                                                                    {option.provider}{option.model ? ` ${option.model}` : ''}
                                                                </div>
                                                            )}
                                                        </label>
                                                    </div>
                                                );
                                            })
                                        ) : (
                                            <p className="text-sm text-gray-500">No service types available. Please add service types in Reference Data first.</p>
                                        )}
                                    </div>
                                </div>
                                <div>
                                    <label htmlFor="basis" className="block text-sm font-medium text-gray-700">Pricing Basis</label>
                                    <select id="basis" name="basis" value={formData.basis} onChange={handleInputChange} className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500">
                                        {Object.values(PricingBasis).map(b => <option key={b} value={b}>{b}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label htmlFor="rate" className="block text-sm font-medium text-gray-700">Rate (€)</label>
                                    <input type="number" name="rate" id="rate" value={formData.rate} onChange={handleInputChange} step="0.01" className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500" required />
                                </div>
                                <div>
                                    <label htmlFor="minimumUsage" className="block text-sm font-medium text-gray-700">
                                        Minimum Usage (Optional)
                                    </label>
                                    <input 
                                        type="number" 
                                        name="minimumUsage" 
                                        id="minimumUsage" 
                                        value={formData.minimumUsage} 
                                        onChange={handleInputChange} 
                                        step="0.01" 
                                        className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500" 
                                        placeholder={formData.basis === PricingBasis.Distance ? 'e.g. 100' : 'e.g. 5'}
                                    />
                                    <p className="mt-1 text-sm text-gray-500">
                                        {formData.basis === PricingBasis.Distance ? 'Minimum kilometers to qualify (e.g. for loyalty discounts)' : 'Minimum hours to qualify (e.g. for loyalty discounts)'}
                                    </p>
                                </div>
                                <div className="sm:col-span-2">
                                    <label htmlFor="userGroup" className="block text-sm font-medium text-gray-700">User Group</label>
                                    <select id="userGroup" name="userGroup" value={formData.userGroup} onChange={handleInputChange} className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500">
                                        {Object.values(UserGroup).map(ug => <option key={ug} value={ug}>{ug}</option>)}
                                    </select>
                                </div>
                                 <div>
                                    <label htmlFor="zoneLocation" className="block text-sm font-medium text-gray-700">Location (City)</label>
                                    <select
                                        id="zoneLocation"
                                        name="zoneLocation"
                                        value={selectedLocation}
                                        onChange={(e) => setSelectedLocation(e.target.value)}
                                        className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                                    >
                                        <option value="">None</option>
                                        {getUniqueLocations().map(loc => (
                                            <option key={loc} value={loc}>{loc}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label htmlFor="zoneType" className="block text-sm font-medium text-gray-700">Zone Type</label>
                                    <select
                                        id="zoneType"
                                        name="zoneType"
                                        value={selectedZoneType}
                                        onChange={(e) => setSelectedZoneType(e.target.value)}
                                        className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                                        disabled={!selectedLocation}
                                    >
                                        <option value="">{selectedLocation ? 'Select type…' : 'Select a location first'}</option>
                                        {getTypesForLocation(selectedLocation).map(t => (
                                            <option key={t} value={t}>{t}</option>
                                        ))}
                                    </select>
                                    {selectedLocation && selectedZoneType && !zones.some(z => z.location === selectedLocation && z.type === selectedZoneType) && (
                                        <p className="mt-1 text-sm text-red-600">No zone found for this Location + Type selection.</p>
                                    )}
                                </div>
                                <div>
                                    <label htmlFor="zoneDiscount" className="block text-sm font-medium text-gray-700">Zone Discount (%)</label>
                                    <input type="number" name="zoneDiscount" id="zoneDiscount" value={formData.zoneDiscount} onChange={handleInputChange} step="0.1" className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500" placeholder="e.g. 10" />
                                </div>
                                <div className="sm:col-span-2">
                                    <label htmlFor="description" className="block text-sm font-medium text-gray-700">Comments (Optional)</label>
                                    <textarea 
                                        name="description" 
                                        id="description" 
                                        value={formData.description} 
                                        onChange={handleInputChange} 
                                        rows={3}
                                        className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500" 
                                        placeholder="Optional notes about this pricing rule..."
                                    />
                                </div>
                            </div>
                            <div className="mt-8 flex justify-end space-x-4">
                                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300">Cancel</button>
                                <button type="submit" className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700">{editingRule ? 'Save Changes' : 'Save Rule'}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default PricingManager;