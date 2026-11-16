import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp, ChevronsUpDown } from 'lucide-react';
import { flexRender, getCoreRowModel, getPaginationRowModel, getSortedRowModel, useReactTable } from '@tanstack/react-table';
import type { ColumnDef, SortingState } from '@tanstack/react-table';
import { useState } from 'react';
import type { ReactElement } from 'react';
import { Button } from '@/components/ui/button.js';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table.js';

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  label: string;
  pageSize?: number;
  getColumnClassName?: (columnId: string) => string | undefined;
}

export function DataTable<TData, TValue>({
  columns,
  data,
  label,
  pageSize = 10,
  getColumnClassName,
}: DataTableProps<TData, TValue>): ReactElement {
  const [sorting, setSorting] = useState<SortingState>([]);
  const table = useReactTable({
    data,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize } },
  });
  const start = data.length === 0 ? 0 : table.getState().pagination.pageIndex * pageSize + 1;
  const end = Math.min(start + pageSize - 1, data.length);

  return (
    <>
      <div className="table-wrap">
        <Table aria-label={label}>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  const sorted = header.column.getIsSorted();
                  const className = getColumnClassName?.(header.column.id);
                  return (
                    <TableHead className={className} key={header.id}>
                      {header.isPlaceholder ? null : header.column.getCanSort()
                        ? <button
                          aria-label={`Sort by ${header.column.id}`}
                          className="table-sort-trigger"
                          onClick={header.column.getToggleSortingHandler()}
                          type="button"
                        >
                          {flexRender(header.column.columnDef.header, header.getContext())}
                          {sorted === 'asc'
                            ? <ChevronUp aria-hidden="true" />
                            : sorted === 'desc'
                              ? <ChevronDown aria-hidden="true" />
                              : <ChevronsUpDown aria-hidden="true" />}
                        </button>
                        : flexRender(header.column.columnDef.header, header.getContext())}
                    </TableHead>
                  );
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length > 0
              ? table.getRowModel().rows.map((row) => (
                <TableRow key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell className={getColumnClassName?.(cell.column.id)} key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
              : <TableRow><TableCell className="table-empty-cell" colSpan={columns.length}>No matching records.</TableCell></TableRow>}
          </TableBody>
        </Table>
      </div>
      <div className="table-pagination">
        <span aria-live="polite">{`Rows ${start}–${end} of ${data.length}`}</span>
        <div className="table-pagination-actions">
          <Button
            aria-label="Previous page"
            className="table-page-button"
            disabled={!table.getCanPreviousPage()}
            onClick={() => table.previousPage()}
            size="sm"
            type="button"
            variant="outline"
          >
            <ChevronLeft aria-hidden="true" /> Previous
          </Button>
          <Button
            aria-label="Next page"
            className="table-page-button"
            disabled={!table.getCanNextPage()}
            onClick={() => table.nextPage()}
            size="sm"
            type="button"
            variant="outline"
          >
            Next <ChevronRight aria-hidden="true" />
          </Button>
        </div>
      </div>
    </>
  );
}
