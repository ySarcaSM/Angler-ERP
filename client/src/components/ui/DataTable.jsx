import React from 'react';
import { useAuth } from '../../context/useAuth';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';

export default function DataTable({ columns, data, pagination, onPageChange, loading, onRowClick }) {
  const { userData } = useAuth();
  const isReadOnly = ['viewer', 'operator'].includes(userData?.role);
  const visibleColumns = isReadOnly
    ? columns.filter((col) => !['_actions', 'actions'].includes(col.key) && col.label !== '')
    : columns;
  const rowClick = isReadOnly ? undefined : onRowClick;

  return (
    <div className="table-container">
      <table className="table">
        <thead>
          <tr>
            {visibleColumns.map((col) => (
              <th key={col.key} style={col.width ? { width: col.width } : {}}>
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <tr>
              <td colSpan={visibleColumns.length} className="text-center py-12">
                <div className="animate-spin w-6 h-6 border-2 border-primary-500 border-t-transparent rounded-full mx-auto" />
              </td>
            </tr>
          ) : data.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="text-center text-dark-500 py-12">
                Nenhum registro encontrado
              </td>
            </tr>
          ) : (
            data.map((row, i) => (
              <tr
                key={row._id || i}
                onClick={() => rowClick?.(row)}
                className={rowClick ? 'cursor-pointer' : ''}
              >
                {visibleColumns.map((col) => (
                  <td key={col.key}>
                    {col.render ? col.render(row[col.key], row) : row[col.key]}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>

      {/* Pagination */}
      {pagination && pagination.pages > 1 && (
        <div className="flex items-center justify-between px-4 py-3 border-t border-dark-800">
          <span className="text-xs text-dark-500">
            {pagination.total} registros · Página {pagination.page} de {pagination.pages}
          </span>
          <div className="flex items-center gap-1">
            <button
              className="btn-ghost btn-sm"
              onClick={() => onPageChange(1)}
              disabled={pagination.page === 1}
            >
              <ChevronsLeft size={14} />
            </button>
            <button
              className="btn-ghost btn-sm"
              onClick={() => onPageChange(pagination.page - 1)}
              disabled={pagination.page === 1}
            >
              <ChevronLeft size={14} />
            </button>
            <span className="px-3 py-1 text-xs text-dark-400">
              {pagination.page}
            </span>
            <button
              className="btn-ghost btn-sm"
              onClick={() => onPageChange(pagination.page + 1)}
              disabled={pagination.page === pagination.pages}
            >
              <ChevronRight size={14} />
            </button>
            <button
              className="btn-ghost btn-sm"
              onClick={() => onPageChange(pagination.pages)}
              disabled={pagination.page === pagination.pages}
            >
              <ChevronsRight size={14} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
