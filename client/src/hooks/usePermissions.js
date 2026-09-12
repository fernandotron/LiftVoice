import { useState, useEffect } from 'react';
import { adminAuthService } from '../services/adminAuthService.js';

export const PERMISSIONS = {
  PERM_ACCESS_ADMIN: 'PERM_ACCESS_ADMIN',
  PERM_ROOM_AUDIO: 'PERM_ROOM_AUDIO',
  PERM_AI_MODELS: 'PERM_AI_MODELS',
  PERM_API_KEYS: 'PERM_API_KEYS',
  PERM_ROOM_MANAGEMENT: 'PERM_ROOM_MANAGEMENT',
};

export const ROLES = {
  LISTENER: 'listener',
  HOST: 'host',
  ADMIN_MASTER: 'admin_master',
};

export function usePermissions() {
  const [role, setRole] = useState(() => {
    if (adminAuthService.getToken()) return ROLES.ADMIN_MASTER;
    if (typeof window !== 'undefined') {
      const search = window.location.search;
      if (search.includes('host=true') || window.location.pathname.startsWith('/admin')) {
        return ROLES.HOST;
      }
    }
    return ROLES.LISTENER;
  });

  useEffect(() => {
    let isMounted = true;
    const determineRole = async () => {
      // Synchronous check first
      if (adminAuthService.getToken()) {
        if (isMounted) setRole(ROLES.ADMIN_MASTER);
        // Maybe also verify async but don't strictly need to if we just trust the token exists for UI render
      } else {
        if (typeof window !== 'undefined') {
          const search = window.location.search;
          if (search.includes('host=true') || window.location.pathname.startsWith('/admin')) {
            if (isMounted) setRole(ROLES.HOST);
          } else {
            if (isMounted) setRole(ROLES.LISTENER);
          }
        }
      }
    };

    determineRole();
    
    const handleStorage = () => determineRole();
    window.addEventListener('storage', handleStorage);
    return () => {
      isMounted = false;
      window.removeEventListener('storage', handleStorage);
    };
  }, []);

  const hasPermission = (permission) => {
    switch (role) {
      case ROLES.ADMIN_MASTER:
        return true;
      case ROLES.HOST:
        return [
          PERMISSIONS.PERM_ACCESS_ADMIN,
          PERMISSIONS.PERM_ROOM_AUDIO,
          PERMISSIONS.PERM_AI_MODELS,
          PERMISSIONS.PERM_ROOM_MANAGEMENT
        ].includes(permission);
      case ROLES.LISTENER:
      default:
        return false;
    }
  };

  return { role, hasPermission, PERMISSIONS, ROLES };
}
