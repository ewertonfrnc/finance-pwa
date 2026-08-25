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
      <path
        d="M14 30.5 21 23l5 4 8-9"
        stroke="var(--finance-mark-accent)"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="3.4"
      />
      <path
        d="M29.5 18H34v4.5"
        stroke="var(--finance-mark-accent)"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="3.4"
      />
    </svg>
  )
}
