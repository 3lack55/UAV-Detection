import { useEffect, useState } from "react";
import { getEvents } from "../services/eventApi";

export function useDashboardEvents(connected) {
  const [events, setEvents] = useState([]);
  const [isEventFetching, setIsEventFetching] = useState(true);

  useEffect(() => {
    if (!connected) return undefined;

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
    const intervalId = setInterval(fetchHistory, 30000);

    return () => {
      cancelled = true;
      clearInterval(intervalId);
    };
  }, [connected]);

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
