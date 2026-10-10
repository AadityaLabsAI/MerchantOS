import { forwardRef, type ButtonHTMLAttributes, type InputHTMLAttributes, type HTMLAttributes, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { cn } from './utils';

export function Button({ className, variant = 'primary', size = 'md', loading, full, disabled, children, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'success' | 'accent';
  size?: 'sm' | 'md' | 'lg' | 'xl'; loading?: boolean; full?: boolean;
}) {
  return (
    <button disabled={disabled || loading}
      className={cn('btn', `btn-${variant}`, `btn-${size}`, full && 'btn-full', className)}
      {...rest}>
      {loading ? <span className="spinner" /> : children}
    </button>
  );
}

export function Card({ className, children, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('card', className)} {...rest}>{children}</div>;
}
export function CardHeader({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn('card-header', className)}>{children}</div>;
}
export function CardBody({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn('card-body', className)}>{children}</div>;
}

export function Badge({ tone = 'neutral', className, children }: { tone?: 'neutral'|'brand'|'success'|'warning'|'error'|'accent'; className?: string; children: ReactNode }) {
  return <span className={cn('badge', `badge-${tone}`, className)}>{children}</span>;
}

export function Input({ className, leftAddon, rightAddon, label, error, ...rest }: InputHTMLAttributes<HTMLInputElement> & {
  leftAddon?: ReactNode; rightAddon?: ReactNode; label?: string; error?: string;
}) {
  return (
    <label className="field">
      {label && <span className="field-label">{label}</span>}
      <span className={cn('field-input', error && 'field-error')}>
        {leftAddon && <span className="field-prefix">{leftAddon}</span>}
        <input className={className} {...rest} />
        {rightAddon && <span className="field-suffix">{rightAddon}</span>}
      </span>
    </label>
  );
}

export function Avatar({ name, size = 40 }: { name: string; size?: number }) {
  const initials = name.split(' ').map(p => p[0]).slice(0, 2).join('').toUpperCase();
  const idx = name.charCodeAt(0) % 4;
  return (
    <div className={cn('avatar', `avatar-${idx}`)} style={{ width: size, height: size, fontSize: Math.round(size * 0.4) }}>
      {initials || '?'}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('skeleton', className)} />;
}

export function EmptyState({ icon, title, hint, cta }: { icon?: ReactNode; title: string; hint?: ReactNode; cta?: ReactNode }) {
  return (
    <div className="empty">
      {icon && <div className="empty-icon">{icon}</div>}
      <h3 className="empty-title">{title}</h3>
      {hint && <p className="empty-hint">{hint}</p>}
      {cta && <div className="mt-5">{cta}</div>}
    </div>
  );
}

export function Tabs({ tabs, active, onChange }: { tabs: { id: string; label: string }[]; active: string; onChange: (id: string) => void }) {
  return (
    <div className="tabs">
      {tabs.map(t => (
        <button key={t.id} onClick={() => onChange(t.id)}
          className={cn('tab', active === t.id && 'tab-active')}>
          {t.label}
        </button>
      ))}
    </div>
  );
}

export function BigMoney({ value, label, tone = 'neutral', size = 'lg' }: {
  value: number | string; label?: string; tone?: 'neutral' | 'success' | 'error' | 'muted'; size?: 'sm'|'md'|'lg'|'xl'|'2xl';
}) {
  const colors = { neutral: 'text-gray-900', success: 'text-success-700', error: 'text-error-700', muted: 'text-gray-500' };
  return (
    <div>
      {label && <div className="text-xs uppercase tracking-wide text-gray-500 font-semibold mb-1">{label}</div>}
      <div className={cn('amount font-bold', colors[tone], `text-${size}`)}>
        {typeof value === 'number' ? '\u20B9' + new Intl.NumberFormat('en-IN').format(value) : value}
      </div>
    </div>
  );
}


export function Textarea({ className, label, error, ...rest }: any) {
  return (
    <div>
      {label && <label className="block text-xs font-semibold text-gray-600 mb-1.5">{label}</label>}
      <textarea
        className={cn('w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent resize-y min-h-[80px]', className)}
        {...rest}
      />
      {error && <div className="text-xs text-error-600 mt-1">{error}</div>}
    </div>
  );
}

export function Field({ label, children, hint, error }: { label?: string; children: ReactNode; hint?: string; error?: string }) {
  return (
    <div>
      {label && <label className="block text-xs font-semibold text-gray-600 mb-1.5">{label}</label>}
      {children}
      {hint && <div className="text-[11px] text-gray-400 mt-1">{hint}</div>}
      {error && <div className="text-xs text-error-600 mt-1">{error}</div>}
    </div>
  );
}

export function Modal({ children, onClose, title }: { children: ReactNode; onClose: () => void; title: string }) {
  return (
    <div className="fixed inset-0 z-50 bg-black/50 grid place-items-end lg:place-items-center p-0 lg:p-4" onClick={onClose}>
      <div className="bg-white w-full max-w-md rounded-t-2xl lg:rounded-2xl shadow-elevated p-5 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-lg text-gray-900">{title}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="size-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
