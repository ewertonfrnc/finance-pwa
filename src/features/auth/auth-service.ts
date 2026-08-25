import type { AuthChangeEvent, Session } from '@supabase/supabase-js'

import { supabase } from '../../lib/supabase/client'

type AuthStateListener = (
  event: AuthChangeEvent,
  session: Session | null,
) => void

export function observeAuthState(listener: AuthStateListener) {
  const {
    data: { subscription },
  } = supabase.auth.onAuthStateChange(listener)

  return () => subscription.unsubscribe()
}

export async function signInWithEmail(input: {
  email: string
  password: string
}) {
  const { data, error } = await supabase.auth.signInWithPassword(input)

  if (error) throw error

  return data.session
}

export async function registerWithEmail(input: {
  email: string
  emailRedirectTo: string
  password: string
}) {
  const { data, error } = await supabase.auth.signUp({
    email: input.email,
    password: input.password,
    options: { emailRedirectTo: input.emailRedirectTo },
  })

  if (error) throw error

  return data
}

export async function requestPasswordRecovery(input: {
  email: string
  redirectTo: string
}) {
  const { error } = await supabase.auth.resetPasswordForEmail(input.email, {
    redirectTo: input.redirectTo,
  })

  if (error) throw error
}

export async function updatePassword(password: string) {
  const { error } = await supabase.auth.updateUser({ password })

  if (error) throw error
}

export async function signOutLocally() {
  const { error } = await supabase.auth.signOut({ scope: 'local' })

  if (error) throw error
}

export async function signOutGlobally() {
  const { error } = await supabase.auth.signOut({ scope: 'global' })

  if (error) throw error
}
