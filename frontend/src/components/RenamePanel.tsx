import { useState } from "react";
import { Button } from "./Button";

interface RenamePanelProps {
  onApply: (fields: { prefix: string; suffix: string; find: string; replace: string }) => void;
}

export function RenamePanel({ onApply }: RenamePanelProps) {
  const [prefix, setPrefix] = useState("");
  const [suffix, setSuffix] = useState("");
  const [find, setFind] = useState("");
  const [replace, setReplace] = useState("");

  return (
    <div className="menu panel">
      <input placeholder="prefix" value={prefix} onChange={(e) => setPrefix(e.target.value)} />
      <input placeholder="suffix" value={suffix} onChange={(e) => setSuffix(e.target.value)} />
      <input placeholder="find" value={find} onChange={(e) => setFind(e.target.value)} />
      <input placeholder="replace" value={replace} onChange={(e) => setReplace(e.target.value)} />
      <Button label="rename" onClick={() => onApply({ prefix, suffix, find, replace })} />
    </div>
  );
}
