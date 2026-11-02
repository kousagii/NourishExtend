import { useCallback, useEffect, useRef, useState } from 'react';
export function useRemote(load, dependencies = []) {
  const [data,setData] = useState(null);
  const [loading,setLoading] = useState(true);
  const [error,setError] = useState('');
  const sequence = useRef(0);
  const refresh = useCallback(async () => {
    const id = ++sequence.current; setLoading(true); setError('');
    try { const value = await load(); if (id === sequence.current) setData(value); }
    catch { if (id === sequence.current) setError('Could not load this information. Check your connection and try again.'); }
    finally { if (id === sequence.current) setLoading(false); }
  }, dependencies);
  useEffect(() => { refresh(); return () => { sequence.current++; }; },[refresh]);
  return { data, loading, error, refresh };
}
export function dateLabel(value) {
  return new Date(value).toLocaleString('en-PH', { timeZone: 'Asia/Manila', month:'short',day:'numeric',hour:'numeric',minute:'2-digit' }) + ' PHT';
}
export const categories = ['Produce','Bakery','Pantry','Prepared','Other'];

