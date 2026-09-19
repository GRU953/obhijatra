// WHAT THIS FILE IS FOR
//   Signing in, and knowing who is signed in. Nothing reaches the server
//   without this, because every rule in the database asks "which organisation
//   is this person in?" and that answer comes from being signed in.
import { getSupabase } from './supabase'

export type SignedIn = { userId: string; organisationId: string; email: string }

export async function currentSession(): Promise<SignedIn | null> {
  const supabase = getSupabase()
  const { data } = await supabase.auth.getUser()
  if (!data.user) return null
  const { data: profile } = await supabase
    .from('profiles').select('organisation_id').eq('id', data.user.id).single()
  if (!profile) return null
  return {
    userId: data.user.id,
    organisationId: (profile as { organisation_id: string }).organisation_id,
    email: data.user.email ?? '',
  }
}

export async function signIn(email: string, password: string): Promise<string | null> {
  const { error } = await getSupabase().auth.signInWithPassword({ email, password })
  return error ? error.message : null
}

export async function signUp(email: string, password: string): Promise<string | null> {
  const { error } = await getSupabase().auth.signUp({ email, password })
  return error ? error.message : null
}

export async function signOut(): Promise<void> {
  await getSupabase().auth.signOut()
}
