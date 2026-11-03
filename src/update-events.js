const listeners=new Set();
export function signalUpdates(){for(const listener of listeners)listener();}
export function subscribeUpdates(listener){listeners.add(listener);return()=>listeners.delete(listener);}
