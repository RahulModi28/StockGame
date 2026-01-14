import { useState, useEffect } from 'react';
import { getNews } from '../api';
import { toast } from 'sonner';
import { useAuth } from '../context/AuthContext';

const NewsTicker = () => {
    const { user } = useAuth();

    useEffect(() => {
        const fetchNews = async () => {
            try {
                // Poll for news every 5 seconds (fast polling for alerts)
                const response = await getNews();
                // Filter for "breaking" news (Whale Alerts are now is_breaking=True)
                const breaking = response.data.filter(n => n.is_breaking);

                // Get seen IDs from session storage to persist across navigations
                const storedSeen = JSON.parse(sessionStorage.getItem('seenAlerts') || '[]');
                const seenSet = new Set(storedSeen);
                let hasNew = false;

                // Check for new breaking items
                breaking.forEach(item => {
                    // Only show alert if NOT seen AND created in the last 5 minutes (avoid old alerts on refresh)
                    const isRecent = (new Date() - new Date(item.released_at)) < 5 * 60 * 1000;

                    // Check if this alert belongs to the current user (prevent duplicate notification)
                    // Alert format: "WHALE ALERT: Team [NAME] has..."
                    // We check if the user's name is in the headline
                    const isMyAlert = user?.name && item.headline.includes(user.name);

                    if (!seenSet.has(item.id) && isRecent) {
                        // Only toast if it's NOT my own alert (I already got the custom UI one)
                        // OR if I don't have a name set (fallback)
                        if (!isMyAlert) {
                            toast(item.headline, {
                                description: "Whale Alert Detected",
                                duration: 15000,
                                action: {
                                    label: 'Dismiss',
                                    onClick: () => console.log('Dismissed'),
                                },
                            });
                        }
                        // Mark as seen regardless, so we don't process it again
                        seenSet.add(item.id);
                        hasNew = true;
                    }
                });

                if (hasNew) {
                    sessionStorage.setItem('seenAlerts', JSON.stringify(Array.from(seenSet)));
                }
            } catch (error) {
                console.error("Failed to fetch alert news", error);
            }
        };

        fetchNews();
        const interval = setInterval(fetchNews, 5000);
        return () => clearInterval(interval);
    }, [user]); // Re-run if user changes (rare)

    return null; // Headless component, no UI
};

export default NewsTicker;
