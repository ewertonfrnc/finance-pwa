import type { ComponentPropsWithoutRef } from 'react'

type GlassCapsuleProps = ComponentPropsWithoutRef<'div'>

export function GlassCapsule({ className = '', ...props }: GlassCapsuleProps) {
  return (
    <div
      className={`rounded-full border border-line/80 bg-panel/90 shadow-(--finance-shadow-subtle) backdrop-blur-xl ${className}`}
      {...props}
    />
  )
}
