import { Button } from "./Button";

interface AddControlProps {
  title: string;
  onClick: () => void;
}

export function AddControl({ title, onClick }: AddControlProps) {
  return <Button icon="plus" ghost title={title} onClick={onClick} />;
}
