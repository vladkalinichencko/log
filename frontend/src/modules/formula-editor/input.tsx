import { Menu } from "../../components/Menu";
import type { FormulaEditorProps } from "./index";

export function FormulaEditor({ value, placeholder, suggestions, error, picking, onChange, onSubmit, onPick }: FormulaEditorProps) {
  return (
    <div className="anchor grow">
      <input
        className={picking ? "grow picking" : "grow"}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && value.trim() && !e.defaultPrevented) onSubmit(value);
        }}
      />
      {error && <span className="error">{error}</span>}
      {suggestions.length > 0 && <Menu items={suggestions.map((name) => ({ label: name, onPick: () => onPick(name) }))} />}
    </div>
  );
}
