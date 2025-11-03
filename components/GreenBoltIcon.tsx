// GreenBoltIcon.tsx
import React from 'react';

const GreenBoltIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg
    className={className}
    width="32"
    height="32"
    viewBox="0 0 32 32"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M14 2L4 18H14V30L24 14H14V2Z"
      fill="#22c55e"
      stroke="#16a34a"
      strokeWidth="2"
      strokeLinejoin="round"
    />
  </svg>
);

export default GreenBoltIcon;
