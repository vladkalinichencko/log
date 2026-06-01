import { Button } from "./Button";

interface AddControlProps {
  label: string;
  onClick: () => void;
}

export function AddControl({ label, onClick }: AddControlProps) {
  return <Button label={label} onClick={onClick} />;
}
