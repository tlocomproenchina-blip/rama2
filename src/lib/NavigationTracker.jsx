import { useEffect, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import { base44 } from '@/api/base44Client';
import { pagesConfig } from '@/pages.config';

export default function NavigationTracker() {
    const location = useLocation();
    const navigate = useNavigate();
    const { isAuthenticated } = useAuth();
    const { Pages, mainPage } = pagesConfig;
    const mainPageKey = mainPage ?? Object.keys(Pages)[0];

    const pageName = useMemo(() => {
        const pathname = location.pathname;

        if (pathname === '/' || pathname === '') {
            return mainPageKey;
        }

        const pathSegment = pathname.replace(/^\//, '').split('/')[0];
        const pageKeys = Object.keys(Pages);
        return pageKeys.find((key) => key.toLowerCase() === pathSegment.toLowerCase()) || null;
    }, [location.pathname, Pages, mainPageKey]);

    useEffect(() => {
        if (!isAuthenticated || !pageName || !base44.appLogs?.logUserInApp) return;

        base44.appLogs.logUserInApp(pageName).catch(() => {
            // Silently fail - logging shouldn't break the app
        });
    }, [isAuthenticated, pageName]);

    return null;
}