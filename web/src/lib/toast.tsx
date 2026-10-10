// Lightweight toast system for user feedback.
// Uses a Zustand store + auto-dismiss.
import { create } from 'zustand';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

type Toast = { id: number; message: string; tone: 'success' | 'error' | 'info' | 'warning' };
type State = {
  toasts: Toast[];
  push: (msg: string, tone?: Toast['tone']) => void;
  dismiss: (id: number) => void;
};

let nextId = 1;

export const useToastStore = create<State>((set) => ({
  toasts: [],
  push: (message, tone = 'info') => {
    const id = nextId++;
    set((s) => ({ toasts: [...s.toasts, { id, message, tone }] }));
    setTimeout(() => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })), 4000);
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

export const useToast = () => {
  const push = useToastStore((s) => s.push);
  return {
    success: (m: string) => push(m, 'success'),
    error: (m: string) => push(m, 'error'),
    warning: (m: string) => push(m, 'warning'),
    info: (m: string) => push(m, 'info'),
  };
};

const ICONS = { success: CheckCircle2, error: AlertCircle, info: Info, warning: AlertCircle };
const TONES = {
  success: 'bg-success-50 border-success-200 text-success-900',
  error:   'bg-error-50 border-error-200 text-error-900',
  info:    'bg-brand-50 border-brand-200 text-brand-900',
  warning: 'bg-warning-50 border-warning-200 text-warning-900',
};

export function ToastContainer() {
  const toasts = useToastStore((s) => s.toasts);
  const dismiss = useToastStore((s) => s.dismiss);
  return (
    <div className="fixed top-4 right-4 z-50 space-y-2 max-w-sm">
      {toasts.map((t) => {
        const Icon = ICONS[t.tone];
        return (
          <div key={t.id} className={`flex items-start gap-3 p-3 rounded-xl border shadow-soft animate-in slide-in-from-right ${TONES[t.tone]}`}>
            <Icon className="size-5 shrink-0 mt-0.5" />
            <div className="flex-1 text-sm font-medium">{t.message}</div>
            <button onClick={() => dismiss(t.id)} aria-label="Close" className="shrink-0 opacity-60 hover:opacity-100">
              <X className="size-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
