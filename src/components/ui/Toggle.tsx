"use client";

interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  id?: string;
}

export default function Toggle({
  checked,
  onChange,
  label,
  id = "toggle",
}: ToggleProps) {
  return (
    <label
      htmlFor={id}
      className="inline-flex items-center gap-2.5 cursor-pointer select-none"
    >
      <button
        id={id}
        role="switch"
        type="button"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`
          relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent
          transition-colors duration-200 ease-in-out
          focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2
          ${checked ? "bg-[var(--accent)]" : "bg-[var(--border)]"}
        `}
      >
        <span
          className={`
            pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-sm
            ring-0 transition-transform duration-200 ease-in-out
            ${checked ? "translate-x-5" : "translate-x-0"}
          `}
        />
      </button>
      {label && (
        <span className="text-sm font-medium text-[var(--text-secondary)]">
          {label}
        </span>
      )}
    </label>
  );
}
