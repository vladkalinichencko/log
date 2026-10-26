import { useStore } from "../store/store";
import { Button } from "./Button";

export function attempt(label: string, work: () => Promise<unknown>) {
  work().catch((error: Error) =>
    useStore.getState().notices_push(`${label}: ${error.message}`, { label: "Retry", perform: () => attempt(label, work) })
  );
}

export function Notices() {
  const notices = useStore((state) => state.notices);
  const dismiss = useStore((state) => state.notices_dismiss);
  if (notices.length === 0) return null;
  return (
    <div className="notices">
      {notices.map((notice) => (
        <div key={notice.id} className="notice" role="alert">
          <span>{notice.message}</span>
          {notice.action && (
            <Button
              label={notice.action.label}
              onClick={() => {
                dismiss(notice.id);
                notice.action!.perform();
              }}
            />
          )}
          <Button icon="close" ghost title="dismiss" onClick={() => dismiss(notice.id)} />
        </div>
      ))}
    </div>
  );
}
