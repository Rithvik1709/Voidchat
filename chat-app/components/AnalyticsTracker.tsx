'use client';

import { useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { usePathname } from 'next/navigation';

export default function AnalyticsTracker() {
    const pathname = usePathname();
    const visited = useRef(false);

    useEffect(() => {
        if (visited.current) return;
        visited.current = true;
        const logVisit = async () => {
            try {
                let visitorId = localStorage.getItem('chat_visitor_id');
                if (!visitorId) {
                    visitorId = crypto.randomUUID();
                    localStorage.setItem('chat_visitor_id', visitorId);
                }
                await supabase.from('site_visits').insert({
                    page: pathname,
                    visitor_id: visitorId
                });
            } catch (error) {
                console.error('Failed to log visit:', error);
            }
        };
        logVisit();
    }, [pathname]);

    return null;
}
