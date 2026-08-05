import { useEffect, useState } from "react";
import { getEvents } from "../services/eventApi";
import { useWebSocket } from "../context/useWebSocket";

export function useDashboardEvents(connected) {
  const [events, setEvents] = useState([]);
  const [isEventFetching, setIsEventFetching] = useState(true);
  const { eventHistory } = useWebSocket();

  useEffect(() => {
    if (!connected) {
      return undefined;
    }

    let cancelled = false;

    const fetchHistory = async () => {
      setIsEventFetching(true);
      try {
        const result = await getEvents();
        if (!cancelled && result.success) {
          setEvents(result.data);
        }
      } catch (error) {
        if (!cancelled) {
          console.error("Error fetching history data:", error);
        }
      } finally {
        if (!cancelled) {
          setIsEventFetching(false);
        }
      }
    };

    fetchHistory();

    return () => {
      cancelled = true;
    };
  }, [connected]);

  useEffect(() => {
    if (connected && eventHistory !== null) {
      setEvents(eventHistory);
    }
  }, [connected, eventHistory]);

  const unReadEvents = events.filter((event) => event.seen === 0);
  const readEvents = events.filter((event) => event.seen === 1);

  return {
    events,
    setEvents,
    isEventFetching,
    setIsEventFetching,
    unReadEvents,
    readEvents,
  };
}
