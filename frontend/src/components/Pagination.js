import React from 'react';
import { CaretLeft, CaretRight } from '@phosphor-icons/react';

const PAGE_SIZE_OPTIONS = [10, 20, 50, 100];

export const usePagination = (data, defaultPageSize = 20) => {
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(defaultPageSize);

  // Veri değişince 1. sayfaya dön
  React.useEffect(() => { setPage(1); }, [data.length]);

  const totalPages = Math.max(1, Math.ceil(data.length / pageSize));
  const start = (page - 1) * pageSize;
  const pageData = data.slice(start, start + pageSize);

  const goTo = (p) => setPage(Math.min(Math.max(1, p), totalPages));

  return { page, pageSize, setPageSize: (s) => { setPageSize(s); setPage(1); }, totalPages, pageData, goTo, total: data.length, start };
};

const Pagination = ({ page, pageSize, setPageSize, totalPages, goTo, total, start }) => {
  if (total === 0) return null;

  const end = Math.min(start + pageSize, total);
  const pages = [];
  const delta = 2;
  for (let i = 1; i <= totalPages; i++) {
    if (i === 1 || i === totalPages || (i >= page - delta && i <= page + delta)) {
      pages.push(i);
    }
  }
  // Elipsis ekle
  const withEllipsis = [];
  for (let i = 0; i < pages.length; i++) {
    if (i > 0 && pages[i] - pages[i - 1] > 1) withEllipsis.push('...');
    withEllipsis.push(pages[i]);
  }

  return (
    <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200 bg-white">
      <div className="flex items-center gap-3 text-sm text-slate-600">
        <span>{start + 1}–{end} / {total} kayıt</span>
        <select
          value={pageSize}
          onChange={e => setPageSize(Number(e.target.value))}
          className="border border-slate-200 px-2 py-1 text-sm outline-none focus:border-slate-900 bg-white"
        >
          {PAGE_SIZE_OPTIONS.map(n => (
            <option key={n} value={n}>{n} / sayfa</option>
          ))}
        </select>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center gap-1">
          <button
            onClick={() => goTo(page - 1)}
            disabled={page === 1}
            className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <CaretLeft size={16} />
          </button>

          {withEllipsis.map((p, i) =>
            p === '...' ? (
              <span key={`e${i}`} className="px-2 text-slate-400 text-sm">…</span>
            ) : (
              <button
                key={p}
                onClick={() => goTo(p)}
                className={`min-w-[32px] h-8 text-sm font-medium transition-colors ${
                  p === page
                    ? 'bg-slate-900 text-white'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                {p}
              </button>
            )
          )}

          <button
            onClick={() => goTo(page + 1)}
            disabled={page === totalPages}
            className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <CaretRight size={16} />
          </button>
        </div>
      )}
    </div>
  );
};

export default Pagination;
