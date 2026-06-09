'use client'

/**
 * PremiumToggle — Interrupteur V4 Light Premium.
 * Track 44x24, gradient orange si activé, gris si désactivé, thumb 20x20 blanc.
 * Description optionnelle pour le contexte sous le label.
 */
export function PremiumToggle({
  checked,
  onChange,
  label,
  description,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  label: string
  description?: string
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-3 px-4 rounded-xl bg-[#fafbfc] border-[1.5px] border-gray-200">
      <div className="flex-1 min-w-0">
        <span className="block font-hanken font-medium text-[14.5px] text-[#0f1a3a]">
          {label}
        </span>
        {description && (
          <span className="block font-hanken text-xs text-gray-500 mt-0.5">
            {description}
          </span>
        )}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className={`relative shrink-0 w-11 h-6 rounded-full transition-colors ${
          checked
            ? 'bg-gradient-to-r from-[#ff7a1a] to-[#ff9d4d] shadow-[0_2px_8px_rgba(255,122,26,0.35)]'
            : 'bg-gray-300'
        }`}
      >
        <span
          className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow-md transition-transform ${
            checked ? 'translate-x-5' : 'translate-x-0'
          }`}
        />
      </button>
    </div>
  )
}

export default PremiumToggle
