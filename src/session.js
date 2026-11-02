import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { configured, supabase, rpc } from './backend';
const SessionContext = createContext(null);
export function SessionProvider({ children }) {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(configured);
  const [error, setError] = useState('');
  const [recovery, setRecovery] = useState(false);
  const currentUser = useRef(null);
  async function refreshProfile() {
    const requestedUser = currentUser.current;
    const result = await rpc('my_profile');
    const data = Array.isArray(result) ? result[0] : result;
    if (currentUser.current === requestedUser) setProfile(data);
    return data;
  }
  useEffect(() => {
    if (!supabase) return;
    let active = true;
    let version = 0;
    async function apply(next) {
      if (!active) return;
      const requestedVersion = ++version;
      if (currentUser.current !== next?.user?.id) { setProfile(null); if (next) setLoading(true); }
      currentUser.current = next?.user?.id || null;
      setSession(next); setError('');
      if (!next) { setProfile(null); setLoading(false); return; }
      try { const data = await rpc('my_profile'); if (active && requestedVersion === version) setProfile(Array.isArray(data) ? data[0] : data); }
      catch { if (active && requestedVersion === version) setError('Your profile could not be loaded. Check your connection and database setup.'); }
      finally { if (active && requestedVersion === version) setLoading(false); }
    }
    supabase.auth.getSession().then(({ data, error }) => {
      if (error) { if (active) { setError('Your session could not be restored. Please sign in again.'); setLoading(false); } }
      else apply(data.session);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, next) => {
      if (event === 'PASSWORD_RECOVERY') setRecovery(true);
      // Avoid awaiting Supabase calls inside the auth callback's lock.
      setTimeout(() => apply(next), 0);
    });
    return () => { active = false; subscription.unsubscribe(); };
  }, []);
  return <SessionContext.Provider value={{ session, profile, refreshProfile, loading, error, recovery, setRecovery }}>{children}</SessionContext.Provider>;
}
export const useSession = () => useContext(SessionContext);
