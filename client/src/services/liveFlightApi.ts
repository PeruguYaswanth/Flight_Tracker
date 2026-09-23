import { ApiResponse } from '../types/flight';

export interface LiveFlightPosition {
  flightNumber: string;
  latitude: number;
  longitude: number;
  heading: number | null;
  altitude: number | null;
  speed: number | null;
  isGround: boolean;
  updatedAt: string | null;
}

const BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

export class LiveFlightApiClient {
  /**
   * Fetches the live aircraft position from the dedicated live-tracking
   * backend endpoint (OpenSky Network, independent of AirLabs).
   *
   * `icao24` - the aircraft's real ICAO24/hex transponder address, already
   * present on the selected flight's `aircraft.icao24` field from the
   * search/details response - is the preferred identifier and is reused
   * here rather than triggering another AirLabs request. `icaoCallsign` is
   * sent as a fallback for flights where AirLabs didn't return a hex.
   */
  public static async getLivePosition(
    flightNumber: string,
    icaoCallsign: string | null,
    icao24: string | null,
    operatingFlightNumber: string | null,
    signal?: AbortSignal
  ): Promise<LiveFlightPosition> {
    const params = new URLSearchParams();
    if (icaoCallsign) params.set('icao', icaoCallsign);
    if (icao24) params.set('icao24', icao24);
    if (operatingFlightNumber) params.set('operatingFlightNumber', operatingFlightNumber);

    const endpoint = `${BASE_URL}/live-flights/${encodeURIComponent(flightNumber)}?${params.toString()}`;

    const response = await fetch(endpoint, { signal });
    const data: ApiResponse<LiveFlightPosition> = await response.json();

    if (!response.ok || !data.success || !data.data) {
      const error: any = new Error(
        data.error?.message || 'Unable to retrieve live aircraft position.'
      );
      error.code = data.error?.code;
      throw error;
    }

    return data.data;
  }
}
