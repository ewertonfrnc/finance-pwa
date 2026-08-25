type BrandMarkProps = {
  className?: string
}

export function BrandMark({ className }: BrandMarkProps) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      viewBox="0 0 48 48"
    >
      <rect fill="currentColor" height="48" rx="16" width="48" />
      <circle cx="10" cy="24" fill="var(--finance-mark-accent)" r="3" />
      <path
        d="M13 24c3.75-10.5 8.25-10.5 11 0s8.25 10.5 11 0"
        stroke="var(--finance-mark-accent)"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="4.5"
      />
      <circle cx="38" cy="24" fill="var(--finance-mark-accent)" r="3" />
    </svg>
  )
}
