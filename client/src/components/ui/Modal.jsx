import React, { useEffect } from 'react';
import { X } from 'lucide-react';

export default function Modal({ open, onClose, title, children, size = 'md', panelClassName = '', backdropClassName = 'bg-black/60 backdrop-blur-sm' }) {
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  if (!open) return null;

  const sizeClasses = {
    sm: 'max-w-md',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl',
    full: 'max-w-6xl',
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className={`absolute inset-0 ${backdropClassName}`} onClick={onClose} />
      <div className={`relative w-full ${sizeClasses[size]} bg-dark-900 border border-dark-800 rounded-2xl shadow-2xl max-h-[90vh] flex flex-col ${panelClassName}`}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-dark-800">
          <h2 className="text-lg font-semibold text-dark-100">{title}</h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-dark-400 hover:text-dark-100 hover:bg-dark-800 transition-all"
          >
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {children}
        </div>
      </div>
    </div>
  );
}
