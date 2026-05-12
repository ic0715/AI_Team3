import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// 브라우저(클라이언트 컴포넌트)에서 사용하는 Supabase client
export const supabase = createClient(supabaseUrl, supabaseAnonKey)
