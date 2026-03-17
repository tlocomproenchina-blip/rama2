import { useEffect, useState } from 'react';
import { base44 } from '@/components/api/ApiQueueManager';

export default function useWarehouseAccess(user, pageName) {
  const [loading, setLoading] = useState(true);
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    let active = true;

    const resolveAccess = async () => {
      if (!user) {
        if (active) {
          setAllowed(false);
          setLoading(false);
        }
        return;
      }

      if (user.role === 'admin' || ['warehouse', 'operations_manager'].includes(user.custom_role)) {
        if (active) {
          setAllowed(true);
          setLoading(false);
        }
        return;
      }

      if (!user.custom_role) {
        if (active) {
          setAllowed(false);
          setLoading(false);
        }
        return;
      }

      try {
        const configs = await base44.entities.RoleConfig.filter({ role_code: user.custom_role, is_active: true }, '-updated_date', 1);
        const roleConfig = configs?.[0];
        const visiblePages = roleConfig?.visible_pages || [];
        if (active) setAllowed(visiblePages.includes(pageName));
      } catch {
        if (active) setAllowed(false);
      }

      if (active) setLoading(false);
    };

    resolveAccess();
    return () => { active = false; };
  }, [user, pageName]);

  return { allowed, loading };
}