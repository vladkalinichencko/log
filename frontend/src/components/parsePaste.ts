const isMarkdownDivider = (cells: string[]) =>
  cells.every((cell) => /^:?-{2,}:?$/.test(cell.trim()));

export function parsePaste(text: string): string[][] {
  const lines = text
    .replace(/\r/g, "")
    .split("\n")
    .filter((line) => line.trim() !== "");
  const rows = lines.map((line) => {
    const trimmed = line.trim();
    if (line.includes("\t")) return line.split("\t").map((cell) => cell.trim());
    if (trimmed.startsWith("|"))
      return trimmed
        .split("|")
        .slice(1, -1)
        .map((cell) => cell.trim());
    return trimmed.split(/\s+/);
  });
  return rows.filter((cells) => !isMarkdownDivider(cells));
}
