
import React, { useEffect, useState } from 'react';
import { MenuIcon } from './icons';
import { useAuth } from '../contexts/AuthContext';

interface HeaderProps {
  toggleSidebar: () => void;
}

const Header: React.FC<HeaderProps> = ({ toggleSidebar }) => {
  const { currentUser } = useAuth();
  const avatarSrc = currentUser?.profilePicture || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(currentUser?.name || 'User') + '&background=0D8ABC&color=fff&size=100';

  // Location
  const [location, setLocation] = useState<string>('');
  const [weather, setWeather] = useState<string>('');
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(async (position) => {
        const { latitude, longitude } = position.coords;
        // OpenWeatherMap API (replace with your API key)
        const apiKey = '2ea9c68f34e7f57f18b239f2aed329d9';
        try {
          // Get weather
          const res = await fetch(`https://api.openweathermap.org/data/2.5/weather?lat=${latitude}&lon=${longitude}&units=metric&appid=${apiKey}`);
          const data = await res.json();
          if (data && data.weather && data.weather[0] && data.main) {
            setWeather(`${data.weather[0].main}, ${Math.round(data.main.temp)}°C`);
          }
          // Get location (city, country)
          if (data && data.name && data.sys && data.sys.country) {
            setLocation(`${data.name}, ${data.sys.country}`);
          } else {
            // fallback to reverse geocoding API
            const geoRes = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`);
            const geoData = await geoRes.json();
            if (geoData && geoData.address) {
              const city = geoData.address.city || geoData.address.town || geoData.address.village || '';
              const country = geoData.address.country || '';
              setLocation(`${city}${city && country ? ', ' : ''}${country}`);
            }
          }
        } catch (err) {
          setWeather('');
          setLocation('');
        }
      });
    }
  }, []);
  return (
    <header className="flex items-center justify-between px-6 py-4 bg-white border-b-2 border-gray-200 shadow-sm">
      <div className="flex items-center">
        <button onClick={toggleSidebar} className="text-gray-500 focus:outline-none lg:hidden">
          <MenuIcon />
        </button>
        <div className="relative mx-4 lg:mx-0">
          <span className="absolute inset-y-0 left-0 flex items-center pl-3">
            <svg className="w-5 h-5 text-gray-500" viewBox="0 0 24 24" fill="none">
              <path d="M21 21L15 15M17 10C17 13.866 13.866 17 10 17C6.13401 17 3 13.866 3 10C3 6.13401 6.13401 3 10 3C13.866 3 17 6.13401 17 10Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
          <input className="w-full py-2 pl-10 pr-4 text-gray-700 bg-white border border-gray-300 rounded-md focus:border-primary-500 focus:ring-primary-500 focus:ring-opacity-40 focus:outline-none" type="text" placeholder="Search" />
        </div>
      </div>

      <div className="flex items-center">
        <div className="flex items-center">
          <img className="object-cover w-10 h-10 rounded-full border border-gray-200" src={avatarSrc} alt={currentUser?.name || 'User Avatar'} />
          <div className="ml-2 hidden sm:block">
            <p className="text-sm font-medium text-gray-700">{currentUser?.name || 'User'}</p>
            <p className="text-xs text-gray-500">{currentUser?.role || ''}</p>
            <p className="text-xs text-gray-500">Location: {location || 'Unknown'}</p>
            {weather && <p className="text-xs text-blue-500">Weather: {weather}</p>}
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
