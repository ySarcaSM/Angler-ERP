import React from 'react';

export default function PageHeader({ title, subtitle, action }) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <h1 className="text-2xl font-bold text-dark-100">{title}</h1>
        {subtitle && <p className="text-dark-500 text-sm mt-1">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}
