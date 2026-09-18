// WHAT THIS FILE IS FOR
//   Connects the app to the server. There is exactly one connection, made once
//   and reused, so the app never opens more than it needs on a cheap phone.
// WHAT IT NEEDS : the server address and the public key, supplied at build time.
// WHAT IT GIVES : `getSupabase()`, the connection every other file uses.
//
// NOTE ON THE KEY: the key used here is the *public* one. It is meant to ship
// inside the app that every user downloads. What protects the data is not this
// key being secret — it is the rules in the database that check which
// organisation the signed-in person belongs to.
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

let client: SupabaseClient | null = null

export function getSupabase(): SupabaseClient {
  if (client) return client
  const url = import.meta.env['VITE_SUPABASE_URL']
  const key = import.meta.env['VITE_SUPABASE_ANON_KEY']
  if (!url || !key) {
    throw new Error(
      'The server address is missing. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY before building.',
    )
  }
  client = createClient(url, key, {
    auth: { persistSession: true, autoRefreshToken: true },
  })
  return client
}
