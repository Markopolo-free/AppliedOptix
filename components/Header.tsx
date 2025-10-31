
import React from 'react';
import { MenuIcon } from './icons';

interface HeaderProps {
  toggleSidebar: () => void;
}

const Header: React.FC<HeaderProps> = ({ toggleSidebar }) => {
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
          <img className="object-cover w-10 h-10 rounded-full" src="https://picsum.photos/100/100" alt="Avatar" />
          <div className="ml-2 hidden sm:block">
            <p className="text-sm font-medium text-gray-700">Admin User</p>
            <p className="text-xs text-gray-500">Administrator</p>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
