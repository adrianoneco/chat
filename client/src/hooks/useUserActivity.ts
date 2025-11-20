import { useEffect, useRef, useState, useCallback } from 'react';
import { useWebSocket } from './useWebSocket';

type ActivityType = 'typing' | 'recording' | 'uploading' | null;

export function useUserActivity(conversationId: string | undefined, otherParticipantId: string | undefined) {
  const { subscribe, send } = useWebSocket();
  const [otherUserActivity, setOtherUserActivity] = useState<ActivityType>(null);
  const activityTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Listen for other user's activity
  useEffect(() => {
    if (!conversationId) return;

    const handler = (data: { conversationId: string; userId: string; activity: ActivityType }) => {
      if (data.conversationId === conversationId) {
        setOtherUserActivity(data.activity);

        // Clear activity after 3 seconds of inactivity
        if (activityTimeoutRef.current) {
          clearTimeout(activityTimeoutRef.current);
        }
        if (data.activity) {
          activityTimeoutRef.current = setTimeout(() => {
            setOtherUserActivity(null);
          }, 3000);
        }
      }
    };

    const unsubscribe = subscribe('user:activity', handler);
    return () => {
      unsubscribe();
      if (activityTimeoutRef.current) {
        clearTimeout(activityTimeoutRef.current);
      }
    };
  }, [conversationId, subscribe]);

  // Send activity status using shared WebSocket connection
  const sendActivity = useCallback((activity: ActivityType) => {
    if (!conversationId || !otherParticipantId) {
      return;
    }

    send('user:activity', {
      conversationId,
      activity,
      otherParticipantId,
    });
  }, [conversationId, otherParticipantId, send]);

  // Clear activity on unmount
  useEffect(() => {
    return () => {
      if (conversationId && otherParticipantId) {
        send('user:activity', {
          conversationId,
          activity: null,
          otherParticipantId,
        });
      }
      if (activityTimeoutRef.current) {
        clearTimeout(activityTimeoutRef.current);
      }
    };
  }, [conversationId, otherParticipantId, send]);

  return {
    otherUserActivity,
    sendActivity,
  };
}
