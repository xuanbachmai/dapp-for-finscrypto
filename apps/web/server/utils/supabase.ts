import { createClient } from '@supabase/supabase-js'

export function useSupabaseServiceRole() {
  const config = useRuntimeConfig()
  const supabaseUrl = config.public.supabaseUrl as string
  const serviceRoleKey = config.supabaseServiceRoleKey as string

  if (!supabaseUrl || !serviceRoleKey) {
    throw createError({
      statusCode: 500,
      message: 'Supabase server configuration is missing. Check SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.',
    })
  }

  return createClient(
    supabaseUrl,
    serviceRoleKey,
  )
}
