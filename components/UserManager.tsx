import React, { useState, useEffect, useCallback } from 'react';
import { ref, get, push, set, serverTimestamp, update, remove } from 'firebase/database';
import { db } from '../services/firebase';
import { User, UserRole } from '../types';

const UserManager: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  // State for the form, used for both adding and editing
  const [formData, setFormData] = useState({ name: '', email: '', role: UserRole.Maker });
  // State to track which user is being edited, if any
  const [editingUser, setEditingUser] = useState<User | null>(null);

  const fetchUsers = useCallback(async () => {
    setIsLoading(true);
    try {
      const usersRef = ref(db, 'users');
      const snapshot = await get(usersRef);

      if (snapshot.exists()) {
          const data = snapshot.val();
          const usersList: User[] = Object.keys(data).map(key => {
              const userData = data[key];
              return {
                  id: key,
                  name: userData.name || '',
                  email: userData.email || '',
                  role: userData.role || UserRole.Maker,
                  createdAt: new Date(userData.createdAt).toISOString(),
                  lastModifiedAt: userData.lastModifiedAt ? new Date(userData.lastModifiedAt).toISOString() : undefined,
                  lastModifiedBy: userData.lastModifiedBy,
              }
          });
          usersList.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
          setUsers(usersList); 
      } else {
          setUsers([]);
      }
    } catch (error) {
        console.error("Error fetching users: ", error);
        alert("Could not fetch user data. Please check the console for errors.");
    } finally {
        setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };
  
  const handleOpenModalForAdd = () => {
    setEditingUser(null);
    setFormData({ name: '', email: '', role: UserRole.Maker });
    setIsModalOpen(true);
  };

  const handleOpenModalForEdit = (user: User) => {
    setEditingUser(user);
    setFormData({ name: user.name, email: user.email, role: user.role });
    setIsModalOpen(true);
  };

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.email) {
        alert("Please fill in all fields.");
        return;
    }
    try {
        if (editingUser) {
            // Update existing user
            const userRef = ref(db, `users/${editingUser.id}`);
            await update(userRef, {
                ...formData,
                lastModifiedAt: serverTimestamp(),
                lastModifiedBy: 'admin_user_placeholder',
            });
        } else {
            // Add new user
            const usersListRef = ref(db, 'users');
            const newUserRef = push(usersListRef);
            await set(newUserRef, {
                ...formData,
                createdAt: serverTimestamp(),
                lastModifiedAt: serverTimestamp(),
                lastModifiedBy: 'admin_user_placeholder',
            });
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
              await remove(ref(db, `users/${userId}`));
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
        <div className="overflow-x-auto">
            <table className="min-w-full text-sm divide-y divide-gray-200">
            <thead className="bg-gray-50">
                <tr>
                <th scope="col" className="px-6 py-3 text-left font-medium text-gray-500 uppercase tracking-wider">Name</th>
                <th scope="col" className="px-6 py-3 text-left font-medium text-gray-500 uppercase tracking-wider">Role</th>
                <th scope="col" className="px-6 py-3 text-left font-medium text-gray-500 uppercase tracking-wider">Created At</th>
                <th scope="col" className="px-6 py-3 text-left font-medium text-gray-500 uppercase tracking-wider">Last Modified</th>
                <th scope="col" className="relative px-6 py-3"><span className="sr-only">Actions</span></th>
                </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
                {isLoading ? (
                    <tr><td colSpan={5} className="text-center py-10 text-gray-500">Loading users from Realtime Database...</td></tr>
                ) : users.length === 0 ? (
                    <tr><td colSpan={5} className="text-center py-10 text-gray-500">No users found in database.</td></tr>
                ) : (
                    users.map((user) => (
                    <tr key={user.id}>
                        <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                            <div className="flex-shrink-0 h-10 w-10">
                            <img className="h-10 w-10 rounded-full" src={`https://i.pravatar.cc/40?u=${user.id}`} alt="" />
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
                        <td className="px-6 py-4 whitespace-nowrap text-gray-500">{user.createdAt ? new Date(user.createdAt).toLocaleString() : 'N/A'}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-gray-500">
                            {user.lastModifiedAt ? new Date(user.lastModifiedAt).toLocaleString() : 'N/A'}
                            {user.lastModifiedBy && <div className="text-xs text-gray-400">by {user.lastModifiedBy}</div>}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right font-medium">
                            <button onClick={() => handleOpenModalForEdit(user)} className="text-primary-600 hover:text-primary-900">Edit</button>
                            <button onClick={() => handleDeleteUser(user.id)} className="ml-4 text-red-600 hover:text-red-900">Delete</button>
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