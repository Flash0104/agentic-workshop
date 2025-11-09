import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createClient(authToken?: string) {
  const cookieStore = await cookies()
  
  const allCookies = cookieStore.getAll()
  console.log('Server cookies available:', allCookies.length)

  const client = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch (error) {
            console.log('Cookie set error:', error)
          }
        },
      },
      global: {
        headers: authToken ? {
          Authorization: `Bearer ${authToken}`
        } : {}
      }
    }
  )
  
  return client
}

