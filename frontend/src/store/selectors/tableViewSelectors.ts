import { Cell, CellType, Table } from "../../types/domain";

export interface TableSort {
  column: number;
  direction: "asc" | "desc";
}

export interface VisibleRow {
  cells: Cell[];
  index: number;
  rowName: string | null;
}

const OPERATORS = /^(.*?)\s*(>=|<=|!=|=|>|<|~)\s*(.*)$/;

export const filter_clauses = (query: string) =>
  query.split(",").map((clause) => clause.trim()).filter(Boolean);

const isNumericColumn = (table: Table, column: number) => {
  const cells = table.cells.map((row) => row[column]).filter(Boolean);
  return cells.some((cell) => cell.type === CellType.Number) &&
    cells.every((cell) => cell.type === CellType.Number || cell.type === CellType.Empty);
};

const filterMatcher = (
  table: Table,
  clause: string
): ((row: Cell[]) => boolean) | string => {
  const match = clause.match(OPERATORS);
  if (!match) {
    const query = clause.toLocaleLowerCase();
    return (row) => row.some((cell) => cell.value.toLocaleLowerCase().includes(query));
  }

  const [, rawColumn, operator, rawValue] = match;
  const column = table.column_names?.findIndex(
    (name) => name.toLocaleLowerCase() === rawColumn.trim().toLocaleLowerCase()
  ) ?? -1;
  if (column < 0) return `Unknown column: ${rawColumn.trim()}`;
  if (!rawValue.trim()) return `Missing value for ${rawColumn.trim()}`;

  if (isNumericColumn(table, column)) {
    if (operator === "~") return `${operator} is only valid for text columns`;
    const expected = Number(rawValue);
    if (Number.isNaN(expected)) return `${rawValue.trim()} is not a number`;
    return (row) => {
      const actual = Number(row[column]?.value);
      if (Number.isNaN(actual)) return false;
      if (operator === "=") return actual === expected;
      if (operator === "!=") return actual !== expected;
      if (operator === ">") return actual > expected;
      if (operator === ">=") return actual >= expected;
      if (operator === "<") return actual < expected;
      return actual <= expected;
    };
  }

  if ([">", ">=", "<", "<="].includes(operator)) {
    return `${operator} is only valid for numeric columns`;
  }
  const expected = rawValue.trim().toLocaleLowerCase();
  return (row) => {
    const actual = (row[column]?.value ?? "").toLocaleLowerCase();
    if (operator === "=") return actual === expected;
    if (operator === "!=") return actual !== expected;
    return actual.includes(expected);
  };
};

const compareCells = (a: Cell | undefined, b: Cell | undefined) => {
  if (a?.type === CellType.Number && b?.type === CellType.Number) {
    return Number(a.value) - Number(b.value);
  }
  return (a?.value ?? "").localeCompare(b?.value ?? "");
};

export function table_view_selector(table: Table, query: string, sorts: TableSort[]) {
  const rows: VisibleRow[] = table.cells.map((cells, index) => ({
    cells,
    index,
    rowName: table.row_names?.[index] ?? null,
  }));
  const clauses = filter_clauses(query);
  const matchers = clauses.map((clause) => filterMatcher(table, clause));
  const error = matchers.find((matcher): matcher is string => typeof matcher === "string") ?? null;
  const visible = error
    ? rows
    : rows.filter((row) =>
        matchers.every((matcher) => typeof matcher === "string" || matcher(row.cells))
      );

  return {
    clauses,
    error,
    rows: [...visible].sort((a, b) => {
      for (const sort of sorts) {
        const order = compareCells(a.cells[sort.column], b.cells[sort.column]);
        if (order !== 0) return sort.direction === "asc" ? order : -order;
      }
      return a.index - b.index;
    }),
  };
}

export const parse_sorts = (value: string | null): TableSort[] =>
  (value ?? "").split(",").flatMap((entry) => {
    const [column, direction] = entry.split(":");
    const index = Number(column);
    return Number.isInteger(index) && (direction === "asc" || direction === "desc")
      ? [{ column: index, direction }]
      : [];
  });

export const serialize_sorts = (sorts: TableSort[]) =>
  sorts.map((sort) => `${sort.column}:${sort.direction}`).join(",");

export const parse_widths = (value: string | null): Record<number, number> =>
  Object.fromEntries(
    (value ?? "").split(",").flatMap((entry) => {
      const [column, width] = entry.split(":").map(Number);
      return Number.isInteger(column) && width >= 80 ? [[column, width]] : [];
    })
  );

export const serialize_widths = (widths: Record<number, number>) =>
  Object.entries(widths).map(([column, width]) => `${column}:${Math.round(width)}`).join(",");
