import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export function useDashboardStats() {
  const [stats, setStats] = useState({
    total_leads: 0,
    contacted: 0,
    replies: 0,
    revenue_closed: 0,
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchStats() {
      const { data, error } = await supabase
        .from('dashboard_stats')
        .select('*')
        .single()

      if (!error && data) setStats(data)
      setLoading(false)
    }

    fetchStats()
  }, [])

  return { stats, loading }
}