import { createClient } from '@supabase/supabase-js'

const SUPA_URL = import.meta.env.VITE_SUPABASE_URL || 'https://tqmqdrifrbvupkrufecc.supabase.co'
const SUPA_KEY = import.meta.env.VITE_SUPABASE_KEY || 'sb_publishable_bQTJDIyQYhx6P3Wljt82JA_gJmnFud1'

export const supabase = createClient(SUPA_URL, SUPA_KEY)
export default supabase
