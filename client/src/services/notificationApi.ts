import { ApiResponse } from '../types/flight';
import { FlightNotification, TrackedFlight } from '../types/notification';

const BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

export interface NotificationsPayload {
  notifications: FlightNotification[];
  unreadCount: number;
}

export interface TrackFlightRequest {
  flightNumber: string;
  flightDate: string;
  depIata: string;
  arrIata: string;
}

async function request<T>(token: string, path: string, init: RequestInit = {}, fallbackMessage: string): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${BASE_URL}${path}`, {
      ...init,
      headers: {
        ...(init.body ? { 'Content-Type': 'application/json' } : {}),
        Authorization: `Bearer ${token}`,
      },
    });
  } catch {
    throw new Error(fallbackMessage);
  }

  let data: ApiResponse<T> | null = null;
  try {
    data = await response.json();
  } catch {
    // Non-JSON body (e.g. a proxy error page) - handled below.
  }

  if (!response.ok || !data?.success) {
    const error: any = new Error(data?.error?.message || fallbackMessage);
    error.code = data?.error?.code;
    error.status = response.status;
    throw error;
  }
  return data.data as T;
}

export class NotificationApiClient {
  public static getNotifications(token: string): Promise<NotificationsPayload> {
    return request(token, '/notifications', {}, 'Unable to update notifications. Please try again.');
  }

  public static markRead(token: string, id: string): Promise<void> {
    return request(token, `/notifications/${encodeURIComponent(id)}/read`, { method: 'PATCH' }, 'Unable to update notification.');
  }

  public static markAllRead(token: string): Promise<void> {
    return request(token, '/notifications/read-all', { method: 'PATCH' }, 'Unable to update notifications.');
  }

  public static deleteNotification(token: string, id: string): Promise<void> {
    return request(token, `/notifications/${encodeURIComponent(id)}`, { method: 'DELETE' }, 'Unable to clear notification.');
  }

  public static getTrackedFlights(token: string): Promise<TrackedFlight[]> {
    return request(token, '/tracked-flights', {}, 'Unable to load tracked flights.');
  }

  public static trackFlight(token: string, body: TrackFlightRequest): Promise<TrackedFlight> {
    return request(token, '/tracked-flights', { method: 'POST', body: JSON.stringify(body) }, 'Unable to track this flight. Please try again.');
  }

  public static untrackFlight(token: string, id: string): Promise<void> {
    return request(token, `/tracked-flights/${encodeURIComponent(id)}`, { method: 'DELETE' }, 'Unable to stop tracking. Please try again.');
  }
}
