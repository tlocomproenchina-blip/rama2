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

    useEffect(() => {
        const handleInternalNavigation = (event) => {
            if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

            const anchor = event.target.closest('a[href]');
            if (!anchor) return;
            if (anchor.target === '_blank' || anchor.hasAttribute('download') || anchor.getAttribute('rel') === 'external') return;

            const url = new URL(anchor.href, window.location.origin);
            if (url.origin !== window.location.origin) return;

            const nextPath = `${url.pathname}${url.search}${url.hash}`;
            const currentPath = `${window.location.pathname}${window.location.search}${window.location.hash}`;
            if (!nextPath.startsWith('/')) return;

            event.preventDefault();
            navigate(nextPath, {
                replace: false,
                state: {
                    navigationId: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
                    from: currentPath,
                },
            });
        };

        document.addEventListener('click', handleInternalNavigation);
        return () => document.removeEventListener('click', handleInternalNavigation);
    }, [navigate, location.pathname, location.search, location.hash]);

    return null;
}