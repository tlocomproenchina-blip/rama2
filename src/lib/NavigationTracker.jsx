import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import { base44 } from '@/api/base44Client';
import { pagesConfig } from '@/pages.config';

const SESSION_KEY = 'employee_activity_session_id';
const IDLE_THRESHOLD_MS = 60000;
const SAMPLE_INTERVAL_MS = 30000;
const HEARTBEAT_INTERVAL_MS = 180000;
const TRACKING_FLAG_KEY = 'tlec_activity_tracking_enabled';
const TRACKING_FLAG_TTL_MS = 5 * 60 * 1000; // 5 min cache

function getAuditSessionId() {
    try {
        const existing = window.sessionStorage.getItem(SESSION_KEY);
        if (existing) return existing;

        const next = `sess_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
        window.sessionStorage.setItem(SESSION_KEY, next);
        return next;
    } catch {
        return `sess_${Date.now()}`;
    }
}

function buildAuditPayload({ user, pageName, path, activityKind, durationMs = 0, activeTimeMs = 0, idleTimeMs = 0 }) {
    return {
        action_type: `activity_${activityKind}`,
        activity_kind: activityKind,
        module_name: pageName || 'General',
        page_name: pageName || path,
        page_path: path,
        area_code: user?.custom_role || user?.role || 'sin_rol',
        area_name: user?.custom_role || user?.role || 'Sin rol',
        session_id: getAuditSessionId(),
        duration_ms: Math.round(durationMs),
        active_time_ms: Math.round(activeTimeMs),
        idle_time_ms: Math.round(idleTimeMs),
        client_side_timestamp: new Date().toISOString(),
        summary: activityKind === 'page_view'
            ? `Ingresó a ${pageName || path}`
            : activityKind === 'page_exit'
                ? `Salió de ${pageName || path}`
                : `Actividad detectada en ${pageName || path}`,
        details: `Ruta: ${path}. Tiempo activo: ${Math.round(activeTimeMs / 1000)}s. Tiempo inactivo: ${Math.round(idleTimeMs / 1000)}s.`,
        metadata: {
            pathname: path,
            source: 'navigation_tracker',
        },
    };
}

export default function NavigationTracker() {
    const location = useLocation();
    const navigate = useNavigate();
    const { isAuthenticated, user } = useAuth();
    const { Pages, mainPage } = pagesConfig;
    const mainPageKey = mainPage ?? Object.keys(Pages)[0];
    const currentPath = `${location.pathname}${location.search}`;
    const pageEnterRef = useRef(Date.now());
    const lastInteractionRef = useRef(Date.now());
    const lastSampleRef = useRef(Date.now());
    const activeTimeRef = useRef(0);
    const idleTimeRef = useRef(0);
    const currentPageRef = useRef(null);
    const [trackingEnabled, setTrackingEnabled] = useState(false);

    // Lee flag global de AppConfig (cacheado 5 min en localStorage para evitar lecturas repetidas)
    useEffect(() => {
        if (!isAuthenticated) return;
        let cancelled = false;
        try {
            const cached = localStorage.getItem(TRACKING_FLAG_KEY);
            if (cached) {
                const { value, ts } = JSON.parse(cached);
                if (Date.now() - ts < TRACKING_FLAG_TTL_MS) {
                    setTrackingEnabled(!!value);
                    return;
                }
            }
        } catch {}
        base44.entities.AppConfig.filter({ config_key: 'main' }, '-updated_date', 1)
            .then((rows) => {
                if (cancelled) return;
                const enabled = !!rows?.[0]?.activity_tracking_enabled;
                setTrackingEnabled(enabled);
                try {
                    localStorage.setItem(TRACKING_FLAG_KEY, JSON.stringify({ value: enabled, ts: Date.now() }));
                } catch {}
            })
            .catch(() => setTrackingEnabled(false));
        return () => { cancelled = true; };
    }, [isAuthenticated]);

    const pageName = useMemo(() => {
        const pathname = location.pathname;

        if (pathname === '/' || pathname === '') {
            return mainPageKey;
        }

        const pathSegment = pathname.replace(/^\//, '').split('/')[0];
        const pageKeys = Object.keys(Pages);
        return pageKeys.find((key) => key.toLowerCase() === pathSegment.toLowerCase()) || pathSegment || null;
    }, [location.pathname, Pages, mainPageKey]);

    const flushSampleRef = useRef(() => {});

    flushSampleRef.current = () => {
        const now = Date.now();
        const delta = now - lastSampleRef.current;
        if (delta <= 0) return;

        const isActiveWindow = !document.hidden && (now - lastInteractionRef.current) <= IDLE_THRESHOLD_MS;
        if (isActiveWindow) {
            activeTimeRef.current += delta;
        } else {
            idleTimeRef.current += delta;
        }

        lastSampleRef.current = now;
    };

    useEffect(() => {
        if (!isAuthenticated || !pageName || !base44.appLogs?.logUserInApp) return;

        base44.appLogs.logUserInApp(pageName).catch(() => {
            // Silently fail - logging shouldn't break the app
        });
    }, [isAuthenticated, pageName]);

    useEffect(() => {
        if (!isAuthenticated || !user || !pageName) return;
        if (!trackingEnabled) return;

        const now = Date.now();
        const previousPage = currentPageRef.current;

        if (previousPage) {
            flushSampleRef.current();
            const durationMs = now - pageEnterRef.current;

            base44.functions.invoke('trackEmployeeActivity', buildAuditPayload({
                user,
                pageName: previousPage.pageName,
                path: previousPage.path,
                activityKind: 'page_exit',
                durationMs,
                activeTimeMs: activeTimeRef.current,
                idleTimeMs: idleTimeRef.current,
            })).catch(() => {});
        }

        currentPageRef.current = { pageName, path: currentPath };
        pageEnterRef.current = now;
        lastInteractionRef.current = now;
        lastSampleRef.current = now;
        activeTimeRef.current = 0;
        idleTimeRef.current = 0;

        base44.functions.invoke('trackEmployeeActivity', buildAuditPayload({
            user,
            pageName,
            path: currentPath,
            activityKind: 'page_view',
        })).catch(() => {});
    }, [currentPath, isAuthenticated, pageName, user, trackingEnabled]);

    useEffect(() => {
        if (!isAuthenticated || !user) return;
        if (!trackingEnabled) return;

        const markInteraction = () => {
            lastInteractionRef.current = Date.now();
        };

        const heartbeat = window.setInterval(() => {
            if (!currentPageRef.current || document.hidden) return;

            flushSampleRef.current();
            const sampledDuration = activeTimeRef.current + idleTimeRef.current;
            if (sampledDuration < HEARTBEAT_INTERVAL_MS / 2 || activeTimeRef.current <= 0) return;

            base44.functions.invoke('trackEmployeeActivity', buildAuditPayload({
                user,
                pageName: currentPageRef.current.pageName,
                path: currentPageRef.current.path,
                activityKind: 'heartbeat',
                durationMs: sampledDuration,
                activeTimeMs: activeTimeRef.current,
                idleTimeMs: idleTimeRef.current,
            }), { dedupeKey: `track-heartbeat-${currentPageRef.current.path}` }).catch(() => {});

            activeTimeRef.current = 0;
            idleTimeRef.current = 0;
            lastSampleRef.current = Date.now();
        }, HEARTBEAT_INTERVAL_MS);

        const sampler = window.setInterval(() => {
            flushSampleRef.current();
        }, SAMPLE_INTERVAL_MS);

        const events = ['pointerdown', 'keydown', 'mousemove', 'scroll', 'touchstart'];
        events.forEach((eventName) => window.addEventListener(eventName, markInteraction, { passive: true }));

        return () => {
            window.clearInterval(heartbeat);
            window.clearInterval(sampler);
            events.forEach((eventName) => window.removeEventListener(eventName, markInteraction));
        };
    }, [isAuthenticated, user, trackingEnabled]);

    useEffect(() => {
        const handleInternalNavigation = (event) => {
            if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

            const anchor = event.target.closest('a[href]');
            if (!anchor) return;
            if (anchor.target === '_blank' || anchor.hasAttribute('download') || anchor.getAttribute('rel') === 'external') return;

            const url = new URL(anchor.href, window.location.origin);
            if (url.origin !== window.location.origin) return;

            const nextPath = `${url.pathname}${url.search}${url.hash}`;
            const currentLocationPath = `${window.location.pathname}${window.location.search}${window.location.hash}`;
            if (!nextPath.startsWith('/')) return;

            event.preventDefault();
            navigate(nextPath, {
                replace: false,
                state: {
                    navigationId: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
                    from: currentLocationPath,
                },
            });
        };

        document.addEventListener('click', handleInternalNavigation);
        return () => document.removeEventListener('click', handleInternalNavigation);
    }, [navigate, location.pathname, location.search, location.hash]);

    return null;
}