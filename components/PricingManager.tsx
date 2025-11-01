import React, { useState, useEffect, useCallback } from 'react';
import { ref, get, push, set, serverTimestamp, update, remove } from 'firebase/database';
import { db } from '../services/firebase';
import { PricingRule, PricingBasis, UserGroup, Zone, Service } from '../types';

const initialNewRuleState = {
    description: '',
    serviceIds: [] as string[],
    basis: PricingBasis.Distance,
    rate: '',
    userGroup: UserGroup.Standard,
    zoneId: '',
    zoneDiscount: '',
};

const PricingManager: React.FC = () => {
    const [rules, setRules] = useState<PricingRule[]>([]);
    const [zones, setZones] = useState<Zone[]>([]); // For dropdown
    const [services, setServices] = useState<Service[]>([]); // For multi-select/info
    const [isLoading, setIsLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [formData, setFormData] = useState(initialNewRuleState);
    const [editingRule, setEditingRule] = useState<PricingRule | null>(null);

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
                list.sort((a, b) => new Date(b.lastModifiedAt).getTime() - new Date(a.lastModifiedAt).getTime());
                setRules(list);
            } else {
                setRules([]);
            }

            // Fetch zones for dropdown
            const zonesRef = ref(db, 'zones');
            const zonesSnapshot = await get(zonesRef);
            if (zonesSnapshot.exists()) {
                const data = zonesSnapshot.val();
                const list: Zone[] = Object.keys(data).map(key => ({ id: key, ...data[key] }));
                setZones(list);
            }

            // Fetch services for reference
            const servicesRef = ref(db, 'services');
            const servicesSnapshot = await get(servicesRef);
            if (servicesSnapshot.exists()) {
                const data = servicesSnapshot.val();
                const list: Service[] = Object.keys(data).map(key => ({ id: key, ...data[key] }));
                setServices(list);
            }

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
        setIsModalOpen(true);
    };

    const handleOpenModalForEdit = (rule: PricingRule) => {
        setEditingRule(rule);
        setFormData({
            description: rule.description,
            serviceIds: rule.serviceIds,
            basis: rule.basis,
            rate: String(rule.rate),
            userGroup: rule.userGroup,
            zoneId: rule.zoneId || '',
            zoneDiscount: rule.zoneDiscount ? String(rule.zoneDiscount) : '',
        });
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

    const handleSaveRule = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!formData.serviceIds || formData.serviceIds.length === 0) {
            alert("Please select at least one service for the rule.");
            return;
        }

        const ruleData = {
            description: formData.description,
            serviceIds: formData.serviceIds,
            basis: formData.basis,
            rate: parseFloat(formData.rate) || 0,
            userGroup: formData.userGroup,
            zoneId: formData.zoneId || null,
            zoneDiscount: formData.zoneDiscount ? parseFloat(formData.zoneDiscount) : null,
            lastModifiedBy: 'usr_admin',
            lastModifiedAt: serverTimestamp(),
        };

        try {
            if (editingRule) {
                const ruleRef = ref(db, `pricingRules/${editingRule.id}`);
                await update(ruleRef, ruleData);
            } else {
                const rulesListRef = ref(db, 'pricingRules');
                const newRuleRef = push(rulesListRef);
                await set(newRuleRef, ruleData);
            }
            setIsModalOpen(false);
            setEditingRule(null);
            await fetchData();
        } catch (error) {
            console.error("Error saving pricing rule:", error);
            alert("Failed to save pricing rule. See console for details.");
        }
    };
    
    const handleDeleteRule = async (ruleId: string) => {
        if (window.confirm('Are you sure you want to delete this pricing rule?')) {
            try {
                await remove(ref(db, `pricingRules/${ruleId}`));
                await fetchData();
            } catch (error) {
                console.error("Error deleting rule:", error);
                alert("Failed to delete pricing rule.");
            }
        }
    };
    
    const getServiceName = (serviceId: string) => services.find(s => s.id === serviceId)?.name || serviceId;
    const getZoneName = (zoneId: string) => zones.find(z => z.id === zoneId)?.name || zoneId;

    return (
        <div>
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-3xl font-bold text-gray-800">Pricing Rule Management</h1>
                <button onClick={handleOpenModalForAdd} className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors">
                    Add Rule
                </button>
            </div>

            <div className="bg-white shadow-md rounded-lg overflow-hidden border border-gray-200">
                <div className="overflow-x-auto">
                    <table className="min-w-full text-sm divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left font-medium text-gray-500 uppercase tracking-wider">Description</th>
                                <th className="px-6 py-3 text-left font-medium text-gray-500 uppercase tracking-wider">Details</th>
                                <th className="px-6 py-3 text-left font-medium text-gray-500 uppercase tracking-wider">Services</th>
                                <th className="px-6 py-3 text-left font-medium text-gray-500 uppercase tracking-wider">Last Modified</th>
                                <th className="relative px-6 py-3"><span className="sr-only">Actions</span></th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {isLoading ? (
                                <tr><td colSpan={5} className="text-center py-10 text-gray-500">Loading pricing rules...</td></tr>
                            ) : rules.length === 0 ? (
                                <tr><td colSpan={5} className="text-center py-10 text-gray-500">No pricing rules found.</td></tr>
                            ) : (
                                rules.map((rule) => (
                                    <tr key={rule.id}>
                                        <td className="px-6 py-4">
                                            <div className="font-medium text-gray-900">{rule.description}</div>
                                            <div className="text-gray-500">{rule.userGroup} users</div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="font-medium text-gray-900">€{rule.rate.toFixed(2)} / {rule.basis === PricingBasis.Distance ? 'km' : 'hr'}</div>
                                            {rule.zoneId && rule.zoneDiscount && <div className="text-gray-500">Zone: {getZoneName(rule.zoneId)} ({rule.zoneDiscount}% off)</div>}
                                        </td>
                                        <td className="px-6 py-4 text-gray-700">{rule.serviceIds.map(getServiceName).join(', ')}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-gray-500">
                                            {new Date(rule.lastModifiedAt).toLocaleString()}
                                            <div className="text-xs text-gray-400">by {rule.lastModifiedBy}</div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right font-medium">
                                            <button onClick={() => handleOpenModalForEdit(rule)} className="text-primary-600 hover:text-primary-900">Edit</button>
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
                                    <label htmlFor="description" className="block text-sm font-medium text-gray-700">Description</label>
                                    <input type="text" name="description" id="description" value={formData.description} onChange={handleInputChange} className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500" required />
                                </div>
                                <div className="sm:col-span-2">
                                    <label className="block text-sm font-medium text-gray-700">Services</label>
                                    <div className="mt-2 p-2 border border-gray-300 rounded-md max-h-40 overflow-y-auto">
                                        {services.length > 0 ? (
                                            services.map(service => (
                                                <div key={service.id} className="flex items-center my-1">
                                                    <input
                                                        id={`service-${service.id}`}
                                                        name="services"
                                                        type="checkbox"
                                                        checked={(formData.serviceIds || []).includes(service.id)}
                                                        onChange={() => handleServiceSelectionChange(service.id)}
                                                        className="h-4 w-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                                                    />
                                                    <label htmlFor={`service-${service.id}`} className="ml-3 text-sm text-gray-700">
                                                        {service.name} <span className="text-gray-500">({service.location})</span>
                                                    </label>
                                                </div>
                                            ))
                                        ) : (
                                            <p className="text-sm text-gray-500">No services available. Please add services first.</p>
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
                                <div className="sm:col-span-2">
                                    <label htmlFor="userGroup" className="block text-sm font-medium text-gray-700">User Group</label>
                                    <select id="userGroup" name="userGroup" value={formData.userGroup} onChange={handleInputChange} className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500">
                                        {Object.values(UserGroup).map(ug => <option key={ug} value={ug}>{ug}</option>)}
                                    </select>
                                </div>
                                 <div>
                                    <label htmlFor="zoneId" className="block text-sm font-medium text-gray-700">Pricing Zone (Optional)</label>
                                    <select id="zoneId" name="zoneId" value={formData.zoneId} onChange={handleInputChange} className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500">
                                        <option value="">None</option>
                                        {zones.map(zone => <option key={zone.id} value={zone.id}>{zone.name} - {zone.location}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label htmlFor="zoneDiscount" className="block text-sm font-medium text-gray-700">Zone Discount (%)</label>
                                    <input type="number" name="zoneDiscount" id="zoneDiscount" value={formData.zoneDiscount} onChange={handleInputChange} step="0.1" className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500" placeholder="e.g. 10" />
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