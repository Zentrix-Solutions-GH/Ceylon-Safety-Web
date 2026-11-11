import * as React from "react";

export interface Column<T> {
  key: string;
  header: string;
  render: (row: T) => React.ReactNode;
  className?: string;
}

interface Props<T> {
  columns: Column<T>[];
  rows: T[];
  getRowKey: (row: T) => string;
  getRowClassName?: (row: T) => string;
  getRowProps?: (row: T) => React.HTMLAttributes<HTMLTableRowElement>;
}

export default function DataTable<T>({ columns, rows, getRowKey, getRowClassName, getRowProps }: Props<T>) {
  return (
    <div className="overflow-x-auto rounded-md border border-border">
      <table className="min-w-full text-sm">
        <thead className="bg-muted/50">
          <tr>
            {columns.map((col) => (
              <th
                key={col.key}
                scope="col"
                className={`px-4 py-3 text-left font-medium text-muted-foreground ${col.className ?? ""}`}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border bg-background">
          {rows.map((row) => (
            <tr
              key={getRowKey(row)}
              className={`hover:bg-muted/30 transition-colors${getRowClassName ? ` ${getRowClassName(row)}` : ""}`}
              {...(getRowProps ? getRowProps(row) : {})}
            >
              {columns.map((col) => (
                <td key={col.key} className={`px-4 py-3 ${col.className ?? ""}`}>
                  {col.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
