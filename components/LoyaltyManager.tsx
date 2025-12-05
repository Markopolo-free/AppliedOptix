import React, { useState, useEffect } from 'react';
import { ref, get, push, update, remove, onValue } from 'firebase/database';
import { db } from '../services/firebase';
import { LoyaltyProgram } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { logAudit, calculateChanges } from '../services/auditService';

const initialNewProgramState = {
  name: '',
  description: '',
  cityName: '',
  pointsPerEuro: '',
  maxPointsPerUser: '',
  totalPointsAvailable: '',
  pointsConsumed: '',
  triggerEvent: '',
  startDate: '',
  endDate: '',
};

const LoyaltyManager: React.FC = () => {
  const { currentUser } = useAuth();
  const [programs, setPrograms] = useState<LoyaltyProgram[]>([]);
  const [isProgramModalOpen, setIsProgramModalOpen] = useState(false);
  const [newProgram, setNewProgram] = useState(initialNewProgramState);
  const [editingProgram, setEditingProgram] = useState<LoyaltyProgram | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [cities, setCities] = useState<Array<{ id: string; name: string; population: number }>>([]);
  const [triggerEvents, setTriggerEvents] = useState<{ id: string; event: string; country: string; city: string }[]>([]);

  // Fetch cities from reference data
  useEffect(() => {
    const citiesRef = ref(db, 'referenceCities');
    const unsubscribe = onValue(citiesRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setCities(Object.entries(data).map(([id, value]) => {
          const v = value as any;
          return {
            id,
            name: v.name || '',
            population: v.population || 0
          };
        }));
      }
    });
    return () => unsubscribe();
  }, []);

  // Fetch trigger events from reference data
  useEffect(() => {
    console.log('LoyaltyManager mounted');
    console.log('db:', db);
    const dbRef = ref(db, 'loyaltyTriggerEvents');
    const unsubscribe = onValue(dbRef, (snapshot) => {
      const data = snapshot.val();
      console.log('loyaltyTriggerEvents:', data);
      if (data) {
        setTriggerEvents(
          Object.entries(data).map(([id, ev]) => {
            const e = ev as any;
            return {
              id,
              event: e.event || '',
              country: e.country || '',
              city: e.city || ''
            };
          })
        );
      } else {
        setTriggerEvents([]);
      }
    });
    return () => unsubscribe();
  }, []);

  // Fetch loyalty programs
  const fetchData = async () => {
    setIsLoading(true);
    try {
      const programsRef = ref(db, 'loyaltyPrograms');
      const snapshot = await get(programsRef);
      if (snapshot.exists()) {
        const data = snapshot.val();
        setPrograms(
          Object.entries(data).map(([id, value]) => {
            const v = value as any;
            return {
              id,
              name: v.name || '',
              description: v.description || '',
              cityName: v.cityName || '',
              pointsPerEuro: v.pointsPerEuro || 0,
              maxPointsPerUser: v.maxPointsPerUser || 0,
              totalPointsAvailable: v.totalPointsAvailable || 0,
              pointsConsumed: v.pointsConsumed || 0,
              startDate: v.startDate || '',
              endDate: v.endDate || '',
              triggerEvent: v.triggerEvent || '',
              status: v.status || '',
              makerName: v.makerName || '',
              makerEmail: v.makerEmail || '',
              makerTimestamp: v.makerTimestamp || '',
              checkerEmail: v.checkerEmail || '',
              checkerTimestamp: v.checkerTimestamp || '',
              lastModifiedBy: v.lastModifiedBy || '',
              lastModifiedAt: v.lastModifiedAt || '',
            };
          })
        );
      } else {
        setPrograms([]);
      }
    } catch (error) {
      setPrograms([]);
    } finally {
      setIsLoading(false);
    }
  };
  useEffect(() => { fetchData(); }, []);

  // Handlers
  const handleOpenProgramModalForAdd = () => {
    setEditingProgram(null);
    setNewProgram(initialNewProgramState);
    setIsProgramModalOpen(true);
  };
  const handleOpenProgramModalForEdit = (program: LoyaltyProgram) => {
    setEditingProgram(program);
    setNewProgram({
      name: program.name,
      description: program.description,
      cityName: program.cityName || '',
      pointsPerEuro: String(program.pointsPerEuro),
      maxPointsPerUser: program.maxPointsPerUser !== undefined ? String(program.maxPointsPerUser) : '',
      totalPointsAvailable: program.totalPointsAvailable !== undefined ? String(program.totalPointsAvailable) : '',
      pointsConsumed: program.pointsConsumed !== undefined ? String(program.pointsConsumed) : '',
      triggerEvent: program.triggerEvent || '',
      startDate: program.startDate || '',
      endDate: program.endDate || '',
    });
    setIsProgramModalOpen(true);
  };
  const handleProgramInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setNewProgram(prev => ({ ...prev, [name]: value }));
  };
  const handleSaveProgram = async (e: React.FormEvent) => {
    e.preventDefault();
    const programData: any = {
      name: newProgram.name,
      description: newProgram.description,
      cityName: newProgram.cityName,
      pointsPerEuro: parseInt(newProgram.pointsPerEuro, 10) || 0,
      triggerEvent: newProgram.triggerEvent,
      startDate: newProgram.startDate,
      endDate: newProgram.endDate,
      lastModifiedBy: currentUser?.email || 'admin',
      lastModifiedAt: new Date().toISOString(),
    };
    if (newProgram.maxPointsPerUser !== '' && !isNaN(parseInt(newProgram.maxPointsPerUser, 10))) {
      programData.maxPointsPerUser = parseInt(newProgram.maxPointsPerUser, 10);
    }
    if (newProgram.totalPointsAvailable !== '' && !isNaN(parseInt(newProgram.totalPointsAvailable, 10))) {
      programData.totalPointsAvailable = parseInt(newProgram.totalPointsAvailable, 10);
    }
    if (newProgram.pointsConsumed !== '' && !isNaN(parseInt(newProgram.pointsConsumed, 10))) {
      programData.pointsConsumed = parseInt(newProgram.pointsConsumed, 10);
    }
    try {
      if (editingProgram) {
        await update(ref(db, `loyaltyPrograms/${editingProgram.id}`), programData);
        // Audit log for update
        const changes = calculateChanges(editingProgram, programData);
        await logAudit({
          userId: currentUser?.id || 'admin',
          userName: currentUser?.name || 'Admin',
          userEmail: currentUser?.email || 'admin',
          action: 'update',
          entityType: 'loyalty',
          entityId: editingProgram.id,
          entityName: programData.name,
          changes,
        });
      } else {
        const newRef = await push(ref(db, 'loyaltyPrograms'), programData);
        // Audit log for create
        await logAudit({
          userId: currentUser?.id || 'admin',
          userName: currentUser?.name || 'Admin',
          userEmail: currentUser?.email || 'admin',
          action: 'create',
          entityType: 'loyalty',
          entityId: newRef.key || '',
          entityName: programData.name,
        });
      }
      setIsProgramModalOpen(false);
      fetchData();
    } catch (error) {
      alert('Failed to save program.');
    }
  };
  const handleDeleteProgram = async (programId: string) => {
    if (window.confirm('Are you sure you want to delete this loyalty program?')) {
      // Find the program for audit log
      const program = programs.find(p => p.id === programId);
      await remove(ref(db, `loyaltyPrograms/${programId}`));
      // Audit log for delete
      await logAudit({
        userId: currentUser?.id || 'admin',
        userName: currentUser?.name || 'Admin',
        userEmail: currentUser?.email || 'admin',
        action: 'delete',
        entityType: 'loyalty',
        entityId: programId,
        entityName: program?.name || '',
        changes: program ? calculateChanges(program, {}) : [],
      });
      fetchData();
    }
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-800">Loyalty Program Management</h1>
        <button 
          onClick={handleOpenProgramModalForAdd}
          className="px-4 py-2 rounded-lg bg-primary-600 text-white hover:bg-primary-700 transition-colors"
        >
          Add Program
        </button>
      </div>
      <div className="bg-white shadow-md rounded-lg overflow-hidden border border-gray-200">
        <div className="overflow-x-auto max-h-[calc(100vh-200px)] overflow-y-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-blue-600 sticky top-0 z-10">
              <tr>
                <th className="px-6 py-4 text-left text-sm font-bold text-white uppercase tracking-wider border-b-2 border-blue-700">Name</th>
                <th className="px-6 py-4 text-left text-sm font-bold text-white uppercase tracking-wider border-b-2 border-blue-700">Description</th>
                <th className="px-6 py-4 text-left text-sm font-bold text-white uppercase tracking-wider border-b-2 border-blue-700">City</th>
                <th className="px-6 py-4 text-left text-sm font-bold text-white uppercase tracking-wider border-b-2 border-blue-700">Trigger Event</th>
                  <th className="px-3 py-2 text-left text-sm font-bold text-white uppercase tracking-wider border-b-2 border-blue-700">Points/Euro & Max/User</th>
                <th className="px-6 py-4 text-left text-sm font-bold text-white uppercase tracking-wider border-b-2 border-blue-700">Total Available</th>
                <th className="px-6 py-4 text-left text-sm font-bold text-white uppercase tracking-wider border-b-2 border-blue-700">Consumed</th>
                <th className="px-6 py-4 text-left text-sm font-bold text-white uppercase tracking-wider border-b-2 border-blue-700">Start Date</th>
                <th className="px-6 py-4 text-left text-sm font-bold text-white uppercase tracking-wider border-b-2 border-blue-700">End Date</th>
                {/* Removed audit field column */}
                <th className="px-6 py-4 text-right text-sm font-bold text-white uppercase tracking-wider border-b-2 border-blue-700">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {isLoading ? (
                <tr><td colSpan={12} className="text-center py-10 text-gray-500">Loading loyalty programs...</td></tr>
              ) : programs.length === 0 ? (
                <tr><td colSpan={12} className="text-center py-10 text-gray-500">No loyalty programs found.</td></tr>
              ) : (
                programs.map(program => (
                  <tr key={program.id}>
                    <td className="px-6 py-4 font-semibold">{program.name}</td>
                    <td className="px-6 py-4 whitespace-pre-line break-words max-w-xs align-top">{program.description}</td>
                    <td className="px-6 py-4">{program.cityName}</td>
                    <td className="px-6 py-4">{program.triggerEvent}</td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      <div>
                        <span className="font-semibold">{program.pointsPerEuro}</span>
                        <span className="text-xs text-gray-500"> pts/€</span>
                      </div>
                      <div>
                        <span className="font-semibold">{program.maxPointsPerUser}</span>
                        <span className="text-xs text-gray-500"> max/user</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">{program.totalPointsAvailable}</td>
                    <td className="px-6 py-4">{program.pointsConsumed}</td>
                    <td className="px-6 py-4 whitespace-nowrap">{program.startDate}</td>
                    <td className="px-6 py-4 whitespace-nowrap">{program.endDate}</td>
                    <td className="px-6 py-4 text-right">
                      <button
                        className="px-2 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 mr-2"
                        onClick={() => handleOpenProgramModalForEdit(program)}
                      >Edit</button>
                      <button
                        className="px-2 py-1 bg-red-500 text-white rounded hover:bg-red-600"
                        onClick={() => handleDeleteProgram(program.id)}
                      >Delete</button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
      {isProgramModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-40 flex justify-center items-center p-4">
          <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-lg max-h-full overflow-y-auto">
            <h2 className="text-2xl font-bold mb-6 text-gray-800">{editingProgram ? 'Edit Loyalty Program' : 'Add New Loyalty Program'}</h2>
            <form onSubmit={handleSaveProgram}>
              <div className="grid grid-cols-1 gap-y-4 gap-x-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-gray-700">Program Name</label>
                  <input type="text" name="name" value={newProgram.name} onChange={handleProgramInputChange} className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm" required />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-gray-700">Description</label>
                  <textarea name="description" value={newProgram.description} onChange={handleProgramInputChange} rows={3} className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm" required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">City</label>
                  <select name="cityName" value={newProgram.cityName} onChange={handleProgramInputChange} className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm">
                    <option value="">Select a city...</option>
                    {cities.map(city => (
                      <option key={city.id} value={city.name}>{city.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Trigger Event</label>
                  <select name="triggerEvent" value={newProgram.triggerEvent} onChange={handleProgramInputChange} className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm">
                    <option value="">Select an event...</option>
                    {triggerEvents.map(ev => (
                      <option key={ev.id} value={ev.event}>
                        {ev.event} {ev.city ? `(${ev.city}${ev.country ? ', ' + ev.country : ''})` : ev.country ? `(${ev.country})` : ''}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Points Per Euro</label>
                  <input type="number" name="pointsPerEuro" value={newProgram.pointsPerEuro} onChange={handleProgramInputChange} className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm" required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Max Points Per User</label>
                  <input type="number" name="maxPointsPerUser" value={newProgram.maxPointsPerUser} onChange={handleProgramInputChange} className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Total Points Available</label>
                  <input type="number" name="totalPointsAvailable" value={newProgram.totalPointsAvailable} onChange={handleProgramInputChange} className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Points Consumed</label>
                  <input type="number" name="pointsConsumed" value={newProgram.pointsConsumed} onChange={handleProgramInputChange} className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Start Date</label>
                  <input type="date" name="startDate" value={newProgram.startDate} onChange={handleProgramInputChange} className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">End Date</label>
                  <input type="date" name="endDate" value={newProgram.endDate} onChange={handleProgramInputChange} className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm" />
                </div>
              </div>
              <div className="mt-8 flex justify-end space-x-4">
                <button type="button" onClick={() => setIsProgramModalOpen(false)} className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700">{editingProgram ? 'Save Changes' : 'Save Program'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default LoyaltyManager;