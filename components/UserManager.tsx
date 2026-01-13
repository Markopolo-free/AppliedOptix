import React, { useState, useEffect, useCallback } from 'react';
import { ref, get, push, set, serverTimestamp, update, remove, onValue, getDatabase } from 'firebase/database';
import { db } from '../services/firebase';
import { User, UserRole } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { logAudit, calculateChanges } from '../services/auditService';
import { queryUsersByTenant } from '../services/multiTenantService';

const UserManager: React.FC = () => {
  const { currentUser, effectiveTenantId } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  // State for the form, used for both adding and editing
  const [formData, setFormData] = useState({ 
    name: '', 
    email: '', 
    role: UserRole.Maker, 
    profilePicture: '', 
    company: '',
    tenantId: '',
    allowedDomains: ['admin', 'dashboard'] as string[],
    defaultDomain: 'dashboard' as string
  });
  // State to track which user is being edited, if any
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [companyNames, setCompanyNames] = useState<string[]>([]);
  
  const availableDomains = ['dashboard', 'admin', 'fx', 'emobility', 'fintech'];
  
  // Define all tenants
  const allTenants = [
    { id: 'emobility-demo', name: 'eMobility Demo' },
    { id: 'fintech-demo', name: 'FinTech Demo' },
    { id: 'corporate-banking', name: 'Corporate Banking' },
    { id: 'retail-banking', name: 'Retail Banking' },
    { id: 'insurance-demo', name: 'Insurance Demo' },
    { id: 'default-tenant', name: 'Default Tenant (Legacy)' }
  ];
  
  // Filter available tenants: only show default-tenant if we're currently in default-tenant context
  const availableTenants = effectiveTenantId === 'default-tenant' 
    ? allTenants
    : allTenants.filter(t => t.id !== 'default-tenant');

  const fetchUsers = useCallback(async () => {
    setIsLoading(true);
    try {
      // Query users filtered by effective tenant
      const usersList = await queryUsersByTenant(effectiveTenantId);
      
      // Convert to User objects with proper formatting
      const formattedUsers: User[] = usersList.map(userData => ({
        id: userData.id,
        name: userData.name || '',
        email: userData.email || '',
        role: userData.role || UserRole.Maker,
        profilePicture: userData.profilePicture,
        company: userData.company || '',
        tenantId: userData.tenantId || 'default-tenant',
        allowedDomains: userData.allowedDomains || ['admin', 'dashboard'],
        defaultDomain: userData.defaultDomain || 'dashboard',
        createdAt: userData.createdAt ? new Date(userData.createdAt).toISOString() : new Date().toISOString(),
        lastModifiedAt: userData.lastModifiedAt ? new Date(userData.lastModifiedAt).toISOString() : undefined,
        lastModifiedBy: userData.lastModifiedBy,
      }));
      
      // Sort by company name (alphabetically, empty company last), then by createdAt desc
      formattedUsers.sort((a, b) => {
        if ((a.company || '').toLowerCase() < (b.company || '').toLowerCase()) return -1;
        if ((a.company || '').toLowerCase() > (b.company || '').toLowerCase()) return 1;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
      
      setUsers(formattedUsers);
    } catch (error) {
      console.error("Error fetching users: ", error);
      alert("Could not fetch user data. Please check the console for errors.");
    } finally {
      setIsLoading(false);
    }
  }, [effectiveTenantId]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  useEffect(() => {
    // Fetch company names from CompanyDetails
    const db = getDatabase();
    const companiesRef = ref(db, 'companies');
    const unsubCompanies = onValue(companiesRef, (snapshot) => {
      const data = snapshot.val() || {};
      const names = Object.values(data).map((item: any) => item.name).filter(Boolean);
      setCompanyNames(names);
    });
    return () => unsubCompanies();
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    
    // Screen: if changing defaultDomain, ensure it's in allowedDomains
    if (name === 'defaultDomain') {
      setFormData(prev => {
        if (prev.allowedDomains.includes(value)) {
          return { ...prev, [name]: value };
        }
        // If not in allowed domains, don't allow the change
        return prev;
      });
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };
  
  const handleDomainToggle = (domain: string) => {
    setFormData(prev => {
      const newAllowedDomains = prev.allowedDomains.includes(domain)
        ? prev.allowedDomains.filter(d => d !== domain)
        : [...prev.allowedDomains, domain];
      
      // Screen: if defaultDomain is no longer in allowedDomains, auto-correct it
      let newDefaultDomain = prev.defaultDomain;
      if (newAllowedDomains.length > 0 && !newAllowedDomains.includes(prev.defaultDomain)) {
        // Pick the first allowed domain as the new default
        newDefaultDomain = newAllowedDomains[0];
      }
      
      return { 
        ...prev, 
        allowedDomains: newAllowedDomains,
        defaultDomain: newDefaultDomain
      };
    });
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check file size (limit to 500KB)
    if (file.size > 500 * 1024) {
      alert('Image size should be less than 500KB. Please choose a smaller image.');
      return;
    }

    // Check file type
    if (!file.type.startsWith('image/')) {
      alert('Please select a valid image file.');
      return;
    }

    // Convert to Base64
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result as string;
      setFormData(prev => ({ ...prev, profilePicture: base64String }));
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveImage = () => {
    setFormData(prev => ({ ...prev, profilePicture: '' }));
  };
  
  const handleOpenModalForAdd = () => {
    setEditingUser(null);
      setFormData({ 
        name: '', 
        email: '', 
        role: UserRole.Maker, 
        profilePicture: '', 
        company: '',
        tenantId: effectiveTenantId,
        allowedDomains: ['admin', 'dashboard'],
        defaultDomain: 'dashboard'
      });
      setIsModalOpen(true);
  };

  const handleOpenModalForEdit = (user: User) => {
      setEditingUser(user);
      setFormData({ 
        name: user.name, 
        email: user.email, 
        role: user.role, 
        profilePicture: user.profilePicture || '', 
        company: user.company || '',
        tenantId: user.tenantId || 'default-tenant',
        allowedDomains: user.allowedDomains || ['admin', 'dashboard'],
        defaultDomain: user.defaultDomain || 'dashboard'
      });
      setIsModalOpen(true);
  };

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validation screening
    if (!formData.name || !formData.email) {
        alert("Please fill in all required fields.");
        return;
    }
    
    if (!formData.tenantId) {
        alert("Please select a tenant.");
        return;
    }
    
    if (formData.allowedDomains.length === 0) {
        alert("Please select at least one allowed domain.");
        return;
    }
    
    // Screen: defaultDomain must be in allowedDomains
    if (!formData.allowedDomains.includes(formData.defaultDomain)) {
        alert("Default domain must be one of the allowed domains.");
        return;
    }
    
    try {
        if (editingUser) {
            // Update existing user
            const userRef = ref(db, `users/${editingUser.id}`);
            await update(userRef, {
                ...formData,
                lastModifiedAt: serverTimestamp(),
                lastModifiedBy: currentUser.email,
            });

            // Log audit for update
            if (currentUser) {
                const changes = calculateChanges(
                    { name: editingUser.name, email: editingUser.email, role: editingUser.role, profilePicture: editingUser.profilePicture },
                    formData
                );
                await logAudit({
                    userId: currentUser.email,
                    userName: currentUser.name,
                    userEmail: currentUser.email,
                    action: 'update',
                    entityType: 'user',
                    entityId: editingUser.id,
                    entityName: formData.name,
                    changes,
                });
            }
        } else {
            // Add new user
            const usersListRef = ref(db, 'users');
            const newUserRef = push(usersListRef);
            await set(newUserRef, {
                ...formData,
                createdAt: serverTimestamp(),
                lastModifiedAt: serverTimestamp(),
                lastModifiedBy: currentUser.email,
            });

            // Log audit for create
            if (currentUser) {
                await logAudit({
                    userId: currentUser.email,
                    userName: currentUser.name,
                    userEmail: currentUser.email,
                    action: 'create',
                    entityType: 'user',
                    entityId: newUserRef.key || '',
                    entityName: formData.name,
                });
            }
        }

        setIsModalOpen(false);
        setEditingUser(null);
        await fetchUsers();
    } catch (error) {
        console.error("Error saving user: ", error);
        alert("Failed to save user. Please see the console for details.");
    }
  };
  
  const handleDeleteUser = async (userId: string) => {
      if (window.confirm('Are you sure you want to delete this user? This action cannot be undone.')) {
          try {
              // Get user details before deletion for audit log
              const userToDelete = users.find(u => u.id === userId);
              
              await remove(ref(db, `users/${userId}`));
              
              // Log audit for delete
              if (currentUser && userToDelete) {
                  await logAudit({
                      userId: currentUser.email,
                      userName: currentUser.name,
                      userEmail: currentUser.email,
                      action: 'delete',
                      entityType: 'user',
                      entityId: userId,
                      entityName: userToDelete.name,
                  });
              }
              
              await fetchUsers();
          } catch (error) {
              console.error("Error deleting user:", error);
              alert("Failed to delete user.");
          }
      }
  };


  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-800">User Management</h1>
        <button onClick={handleOpenModalForAdd} className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors">
          Add User
        </button>
      </div>

      <div className="bg-white shadow-md rounded-lg overflow-hidden border border-gray-200">
        <div className="overflow-x-auto max-h-[calc(100vh-200px)] overflow-y-auto">
            <table className="min-w-full text-sm">
            <thead className="bg-blue-600 sticky top-0 z-10">
                <tr>
                <th scope="col" className="px-6 py-4 text-left text-sm font-bold text-white uppercase tracking-wider border-b-2 border-blue-700">Name</th>
                <th scope="col" className="px-6 py-4 text-left text-sm font-bold text-white uppercase tracking-wider border-b-2 border-blue-700">Role</th>
                <th scope="col" className="px-6 py-4 text-left text-sm font-bold text-white uppercase tracking-wider border-b-2 border-blue-700">Company</th>
                <th scope="col" className="px-6 py-4 text-left text-sm font-bold text-white uppercase tracking-wider border-b-2 border-blue-700">Tenant ID</th>
                <th scope="col" className="px-6 py-4 text-left text-sm font-bold text-white uppercase tracking-wider border-b-2 border-blue-700">Allowed Domains</th>
                <th scope="col" className="px-6 py-4 text-left text-sm font-bold text-white uppercase tracking-wider border-b-2 border-blue-700">Created At</th>
                <th scope="col" className="px-6 py-4 text-right text-sm font-bold text-white uppercase tracking-wider border-b-2 border-blue-700">Actions</th>
                </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
                                {isLoading ? (
                                        <tr><td colSpan={7} className="text-center py-10 text-gray-500">Loading users from Realtime Database...</td></tr>
                                ) : users.length === 0 ? (
                                        <tr><td colSpan={7} className="text-center py-10 text-gray-500">No users found in database.</td></tr>
                                ) : (
                                        (() => {
                                            let lastCompany = null;
                                            return users.map((user, idx) => {
                                                const showDivider = lastCompany !== null && lastCompany !== (user.company || "");
                                                const row = (
                                                    <React.Fragment key={user.id}>
                                                        {showDivider && (
                                                            <tr>
                                                                <td colSpan={7}>
                                                                    <div className="border-t-2 border-blue-400 my-1"></div>
                                                                </td>
                                                            </tr>
                                                        )}
                                                        <tr>
                                                            <td className="px-6 py-4 whitespace-nowrap">
                                                                <div className="flex items-center">
                                                                    <div className="flex-shrink-0 h-10 w-10">
                                                                        <img className="h-10 w-10 rounded-full object-cover" src={user.profilePicture || `https://i.pravatar.cc/40?u=${user.id}`} alt={user.name} />
                                                                    </div>
                                                                    <div className="ml-4">
                                                                        <div className="font-medium text-gray-900">{user.name}</div>
                                                                        <div className="text-gray-500">{user.email}</div>
                                                                    </div>
                                                                </div>
                                                            </td>
                                                            <td className="px-6 py-4 whitespace-nowrap">
                                                                <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                                                                    user.role === UserRole.Administrator ? 'bg-red-100 text-red-800' :
                                                                    user.role === UserRole.Maker ? 'bg-blue-100 text-blue-800' :
                                                                    user.role === UserRole.Checker ? 'bg-yellow-100 text-yellow-800' :
                                                                    'bg-green-100 text-green-800'
                                                                }`}>
                                                                    {user.role}
                                                                </span>
                                                            </td>
                                                            <td className="px-6 py-4 whitespace-nowrap text-gray-900">{user.company || <span className="text-gray-400">N/A</span>}</td>
                                                            <td className="px-6 py-4 whitespace-nowrap">
                                                                {user.tenantId && user.tenantId !== 'default-tenant' ? (
                                                                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                                                                        {user.tenantId}
                                                                    </span>
                                                                ) : (
                                                                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                                                                        {user.tenantId || 'default-tenant'} (Legacy)
                                                                    </span>
                                                                )}
                                                            </td>
                                                            <td className="px-6 py-4">
                                                                <div className="flex flex-wrap gap-1">
                                                                    {(user.allowedDomains || ['admin', 'dashboard']).map(domain => (
                                                                        <span key={domain} className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                                                                            {domain}
                                                                        </span>
                                                                    ))}
                                                                </div>
                                                            </td>
                                                            <td className="px-6 py-4 whitespace-nowrap text-gray-500">{user.createdAt ? new Date(user.createdAt).toLocaleString() : 'N/A'}</td>
                                                            <td className="px-6 py-4 whitespace-nowrap text-right font-medium">
                                                                <button
                                                                    className="px-2 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 mr-2"
                                                                    onClick={() => handleOpenModalForEdit(user)}
                                                                >Edit</button>
                                                                <button
                                                                    className="px-2 py-1 bg-red-500 text-white rounded hover:bg-red-600"
                                                                    onClick={() => handleDeleteUser(user.id)}
                                                                >Delete</button>
                                                            </td>
                                                        </tr>
                                                    </React.Fragment>
                                                );
                                                lastCompany = user.company || "";
                                                return row;
                                            });
                                        })()
                                )}
            </tbody>
            </table>
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-40 flex justify-center items-center p-4">
            <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-md">
                <h2 className="text-2xl font-bold mb-6 text-gray-800">{editingUser ? 'Edit User' : 'Add New User'}</h2>
                <form onSubmit={handleSaveUser}>
                    <div className="mb-4">
                        <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
                        <input type="text" id="name" name="name" value={formData.name} onChange={handleInputChange} className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500" required />
                    </div>
                    <div className="mb-4">
                        <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
                        <input type="email" id="email" name="email" value={formData.email} onChange={handleInputChange} className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500" required />
                    </div>
                    <div className="mb-4">
                        <label htmlFor="profilePicture" className="block text-sm font-medium text-gray-700 mb-1">Profile Picture (Optional)</label>
                        <div className="flex items-center space-x-4">
                            {formData.profilePicture && (
                                <div className="relative">
                                    <img src={formData.profilePicture} alt="Profile Preview" className="w-20 h-20 rounded-full object-cover border-2 border-gray-300" />
                                    <button type="button" onClick={handleRemoveImage} className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center hover:bg-red-600" title="Remove picture">×</button>
                                </div>
                            )}
                            <div className="flex-1">
                                <input type="file" id="profilePicture" accept="image/*" onChange={handleImageUpload} className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 text-sm" />
                                <p className="text-xs text-gray-500 mt-1">Max size: 500KB. Supported formats: JPG, PNG, GIF</p>
                            </div>
                        </div>
                    </div>
                    <div className="mb-4">
                        <label className="block text-sm font-medium mb-1">Company</label>
                        <select name="company" value={formData.company} onChange={handleInputChange} className="w-full px-3 py-2 border rounded">
                          <option value="">Select Company</option>
                          {companyNames.map(name => <option key={name} value={name}>{name}</option>)}
                        </select>
                    </div>
                    
                    {/* MULTI-TENANT FIELDS */}
                    <div className="mb-4 p-4 bg-purple-50 border border-purple-200 rounded-lg">
                        <h3 className="text-sm font-semibold text-purple-900 mb-3">Multi-Tenant Configuration</h3>
                        
                        <div className="mb-3">
                            <label htmlFor="tenantId" className="block text-sm font-medium text-gray-700 mb-1">
                                Tenant ID <span className="text-red-500">*</span>
                            </label>
                            <select
                                id="tenantId" 
                                name="tenantId" 
                                value={formData.tenantId} 
                                onChange={handleInputChange}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-purple-500 focus:border-purple-500"
                                required
                            >
                                <option value="">Select Tenant</option>
                                {availableTenants.map(tenant => (
                                    <option key={tenant.id} value={tenant.id}>{tenant.name}</option>
                                ))}
                            </select>
                            <p className="text-xs text-gray-500 mt-1">Unique identifier for data isolation</p>
                        </div>
                        
                        <div className="mb-3">
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Allowed Domains <span className="text-red-500">*</span>
                            </label>
                            <div className="grid grid-cols-2 gap-2">
                                {availableDomains.map(domain => (
                                    <label key={domain} className="flex items-center space-x-2 p-2 border rounded hover:bg-gray-50 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={formData.allowedDomains.includes(domain)}
                                            onChange={() => handleDomainToggle(domain)}
                                            className="rounded text-purple-600 focus:ring-purple-500"
                                        />
                                        <span className="text-sm capitalize">{domain}</span>
                                    </label>
                                ))}
                            </div>
                            <p className="text-xs text-gray-500 mt-1">Which portals can this user access?</p>
                        </div>
                        
                        <div className="mb-0">
                            <label htmlFor="defaultDomain" className="block text-sm font-medium text-gray-700 mb-1">
                                Default Domain <span className="text-red-500">*</span>
                            </label>
                            <select 
                                id="defaultDomain" 
                                name="defaultDomain" 
                                value={formData.defaultDomain} 
                                onChange={handleInputChange}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-purple-500 focus:border-purple-500"
                                required
                            >
                                {formData.allowedDomains.length > 0 ? (
                                    formData.allowedDomains.map(domain => (
                                        <option key={domain} value={domain}>{domain}</option>
                                    ))
                                ) : (
                                    <option value="dashboard">dashboard</option>
                                )}
                            </select>
                            <p className="text-xs text-gray-500 mt-1">Starting portal on login</p>
                        </div>
                    </div>
                    
                    <div className="mb-6">
                        <label htmlFor="role" className="block text-sm font-medium text-gray-700 mb-1">User Role</label>
                        <select id="role" name="role" value={formData.role} onChange={handleInputChange} className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500">
                            {Object.values(UserRole).map(role => <option key={role} value={role}>{role}</option>)}
                        </select>
                    </div>
                    <div className="mt-8 flex justify-end space-x-4">
                        <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300">Cancel</button>
                        <button type="submit" className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700">{editingUser ? 'Save Changes' : 'Add User'}</button>
                    </div>
                </form>
            </div>
        </div>
      )}
    </div>
  );
};

export default UserManager;