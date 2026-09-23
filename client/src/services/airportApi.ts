import { ApiResponse } from '../types/flight';
import { AirportDetails, AirportSummary } from '../types/airport';

const BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

export class AirportApiClient {
  public static async listAirports(signal?: AbortSignal): Promise<AirportSummary[]> {
    const response = await fetch(`${BASE_URL}/airports`, { signal });
    const data: ApiResponse<AirportSummary[]> = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(data.error?.message || 'Unable to load airports.');
    }

    return data.data || [];
  }

  public static async getAirportDetails(code: string, signal?: AbortSignal): Promise<AirportDetails> {
    const response = await fetch(`${BASE_URL}/airports/${encodeURIComponent(code.trim().toUpperCase())}`, { signal });
    const data: ApiResponse<AirportDetails> = await response.json();

    if (!response.ok || !data.success || !data.data) {
      throw new Error(
        data.error?.message ||
        (response.status === 404
          ? `No airport found for code "${code}".`
          : 'Unable to load airport information.')
      );
    }

    return data.data;
  }
}
