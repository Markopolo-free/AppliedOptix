
import React, { useEffect, useState } from 'react';
import GreenBoltIcon from './GreenBoltIcon';
import { userEmailExists, getUserByEmail } from './userManagementService';
import { validateCredentials } from '../services/testCredentialsService';
import DebugSecrets from './DebugSecrets';
import { useAuth } from '../contexts/AuthContext';
import { logAudit } from '../services/auditService';

const menuItems = [
  { label: 'Rules Set-up', key: 'rules' },
  { label: 'Campaigns', key: 'campaigns' },
  { label: 'Reference Data', key: 'reference' },
  { label: 'Users', key: 'users' },
];

interface LandingPageProps {
  onAuthSuccess?: () => void;
}

const LandingPage: React.FC<LandingPageProps> = ({ onAuthSuccess }) => {
  const { setCurrentUser } = useAuth();
  const [step, setStep] = useState<'login' | 'register' | 'success'>('login');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberEmail, setRememberEmail] = useState<boolean>(true);
  const LAST_EMAIL_KEY = 'lastEmail';
  const REMEMBER_EMAIL_KEY = 'rememberEmail';
    useEffect(() => {
      try {
        const remember = localStorage.getItem(REMEMBER_EMAIL_KEY);
        if (remember !== null) {
          setRememberEmail(remember === 'true');
        }
        if (remember === null || remember === 'true') {
          const last = localStorage.getItem(LAST_EMAIL_KEY);
          if (last) setEmail(last);
        }
      } catch (_) {}
    }, []);

    const handleLogin = async (e: React.FormEvent) => {
      e.preventDefault();
      try {
        if (rememberEmail) {
          localStorage.setItem(LAST_EMAIL_KEY, email);
        } else {
          localStorage.removeItem(LAST_EMAIL_KEY);
        }
      } catch (_){ /* ignore */ }
      if (await userEmailExists(email)) {
        if (validateCredentials(email, password)) {
          const user = await getUserByEmail(email);
          if (user) {
            setCurrentUser({ email: user.email, name: user.name, role: user.role, profilePicture: user.profilePicture });
            await logAudit({
              userId: user.email,
              userName: user.name,
              userEmail: user.email,
              action: 'login',
              entityType: 'auth',
              metadata: { timestamp: new Date().toISOString() }
            });
          }
          setStep('success');
          setError('');
          if (onAuthSuccess) onAuthSuccess();
        } else {
          setError('Invalid password. Please check your credentials.');
        }
      } else {
        setError('Email not found. Contact administrator to add test credentials.');
      }
    };

    const handleMenuClick = (key: string) => {
      // Example: setStep(key) or route to another page
      // For now, just log
      console.log('Menu clicked:', key);
    };

    const handleClearEmail = () => {
      try { localStorage.removeItem(LAST_EMAIL_KEY); } catch (_) { /* ignore */ }
      setEmail('');
    };

    const handleToggleRemember = (e: React.ChangeEvent<HTMLInputElement>) => {
      const checked = e.target.checked;
      setRememberEmail(checked);
      try {
        localStorage.setItem(REMEMBER_EMAIL_KEY, String(checked));
        if (!checked) {
          localStorage.removeItem(LAST_EMAIL_KEY);
        } else if (email) {
          localStorage.setItem(LAST_EMAIL_KEY, email);
        }
      } catch (_) { /* ignore */ }
    };

    const handleRegister = (e: React.FormEvent) => {
      e.preventDefault();
      setError('Registration disabled. Contact administrator to add test credentials.');
    };

    return (
      <div className="flex h-screen bg-gray-100 font-sans">
        {/* Left nav style */}
        <div className="w-64 bg-gray-800 flex flex-col h-screen">
          <div className="flex flex-col items-center w-full px-8 pt-8">
            <span className="text-2xl font-bold text-white mb-4">Adaptive Optix</span>
            <nav className="flex flex-col gap-2 w-full">
              {menuItems.map(item => (
                <button
                  key={item.key}
                  className="text-lg text-gray-300 hover:text-white text-left w-full py-2 px-4 rounded transition"
                  onClick={() => handleMenuClick(item.key)}
                >
                  {item.label}
                </button>
              ))}
            </nav>
          </div>
          {/* Logo box removed as requested */}
        </div>
        <div className="flex-1 flex flex-col items-center justify-center">
          <div className="bg-white rounded-xl shadow-md p-8 w-full max-w-md">
            <h1 className="text-3xl font-bold text-gray-800 mb-6 text-center">Welcome to eMobility Rules Set-up</h1>
            {step === 'login' && (
              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Email Address</label>
                  <input
                    type="email"
                    value={email}
                    onChange={e => { const v = e.target.value; setEmail(v); try { if (rememberEmail) { localStorage.setItem(LAST_EMAIL_KEY, v); } } catch(_){} }}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                    required
                  />
                  <div className="mt-1 text-right">
                    <div className="mt-1 flex items-center justify-between">
                      <label className="inline-flex items-center gap-2 text-sm text-gray-700">
                        <input type="checkbox" className="form-checkbox" checked={rememberEmail} onChange={handleToggleRemember} />
                        Remember this email
                      </label>
                      <button type="button" onClick={handleClearEmail} className="text-sm text-gray-500 hover:text-gray-700 underline">Clear saved email</button>
                    </div>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Password</label>
                  <input type="password" value={password} onChange={e => setPassword(e.target.value)} className="w-full px-4 py-2 border border-gray-300 rounded-lg" required />
                </div>
                <button type="submit" className="w-full py-3 bg-blue-600 text-white rounded-lg font-semibold">Login</button>
                {error && <p className="text-red-600 text-sm mt-2">{error}</p>}
              </form>
            )}
            {step === 'register' && (
              <form onSubmit={handleRegister} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Name</label>
                  <input type="text" value={name} onChange={e => setName(e.target.value)} className="w-full px-4 py-2 border border-gray-300 rounded-lg" required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Email Address</label>
                  <input
                    type="email"
                    value={email}
                    onChange={e => { const v = e.target.value; setEmail(v); try { if (rememberEmail) { localStorage.setItem(LAST_EMAIL_KEY, v); } } catch(_){} }}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                    required
                  />
                  <div className="mt-1 text-right">
                    <div className="mt-1 flex items-center justify-between">
                      <label className="inline-flex items-center gap-2 text-sm text-gray-700">
                        <input type="checkbox" className="form-checkbox" checked={rememberEmail} onChange={handleToggleRemember} />
                        Remember this email
                      </label>
                      <button type="button" onClick={handleClearEmail} className="text-sm text-gray-500 hover:text-gray-700 underline">Clear saved email</button>
                    </div>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Password</label>
                  <input type="password" value={password} onChange={e => setPassword(e.target.value)} className="w-full px-4 py-2 border border-gray-300 rounded-lg" required />
                </div>
                <button type="submit" className="w-full py-3 bg-blue-600 text-white rounded-lg font-semibold">Register</button>
                {error && <p className="text-red-600 text-sm mt-2">{error}</p>}
              </form>
            )}
            {step === 'success' && (
              <div className="text-center">
                <h2 className="text-xl font-semibold text-green-700 mb-4">Login Successful!</h2>
                <p className="text-gray-700">Welcome, {name || email}!</p>
              </div>
            )}
          </div>
        </div>
        {/* Only show debug component in development */}
        {process.env.NODE_ENV !== 'production' && <DebugSecrets />}
      </div>
    );
  };

export default LandingPage;
