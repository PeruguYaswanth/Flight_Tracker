import { ApiResponse } from '../types/flight';
import { FlightNotification, TrackedFlight } from '../types/notification';
import { API_BASE_URL } from './apiBase';
import { fetchWithTimeout } from './http';

const BASE_URL = API_BASE_URL;

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

async function request<T>(path: string, init: RequestInit = {}, fallbackMessage: string): Promise<T> {
  let response: Response;
  try {
    response = await fetchWithTimeout(`${BASE_URL}${path}`, {
      ...init,
      headers: init.body ? { 'Content-Type': 'application/json' } : undefined,
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
  public static getNotifications(): Promise<NotificationsPayload> {
    return request('/notifications', {}, 'Unable to update notifications. Please try again.');
  }

  public static markRead(id: string): Promise<void> {
    return request(`/notifications/${encodeURIComponent(id)}/read`, { method: 'PATCH' }, 'Unable to update notification.');
  }

  public static markAllRead(): Promise<void> {
    return request('/notifications/read-all', { method: 'PATCH' }, 'Unable to update notifications.');
  }

  public static deleteNotification(id: string): Promise<void> {
    return request(`/notifications/${encodeURIComponent(id)}`, { method: 'DELETE' }, 'Unable to clear notification.');
  }

  public static getTrackedFlights(): Promise<TrackedFlight[]> {
    return request('/tracked-flights', {}, 'Unable to load tracked flights.');
  }

  public static trackFlight(body: TrackFlightRequest): Promise<TrackedFlight> {
    return request('/tracked-flights', { method: 'POST', body: JSON.stringify(body) }, 'Unable to track this flight. Please try again.');
  }

  public static untrackFlight(id: string): Promise<void> {
    return request(`/tracked-flights/${encodeURIComponent(id)}`, { method: 'DELETE' }, 'Unable to stop tracking. Please try again.');
  }
}
