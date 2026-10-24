import { Button } from "./Button";

export function LoadError({ message, retry }: { message: string; retry: () => void }) {
  return (
    <div className="load-error" role="alert">
      <span>{message}</span>
      <Button label="Retry" onClick={retry} />
    </div>
  );
}
