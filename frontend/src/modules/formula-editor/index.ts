export interface FormulaEditorProps {
  value: string;
  placeholder: string;
  suggestions: string[];
  error: string | null;
  picking: boolean;
  onChange: (text: string) => void;
  onSubmit: (text: string) => void;
  onPick: (suggestion: string) => void;
}

export { FormulaEditor } from "./input";
