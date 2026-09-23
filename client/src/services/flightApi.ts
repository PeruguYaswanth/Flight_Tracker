import { ApiResponse, Flight, FlightSearchFilters } from '../types/flight';

const BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

export class FlightApiClient {
  /**
   * Search flights by filters
   */
  public static async searchFlights(
    filters: FlightSearchFilters,
    signal?: AbortSignal
  ): Promise<Flight[]> {
    const params = new URLSearchParams();

    if (filters.mode === 'route') {
      if (filters.depIata) params.append('depIata', filters.depIata.trim().toUpperCase());
      if (filters.arrIata) params.append('arrIata', filters.arrIata.trim().toUpperCase());
      if (filters.flightDate) params.append('flightDate', filters.flightDate);
    } else {
      if (filters.flightNumber) params.append('flightNumber', filters.flightNumber.trim().toUpperCase());
      if (filters.airline) params.append('airline', filters.airline.trim());
      if (filters.flightDate) params.append('flightDate', filters.flightDate);
    }

const endpoint = `${BASE_URL}/api/flights/search?${params.toString()}`;

    try {
      const response = await fetch(endpoint, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        signal,
      });

      const data: ApiResponse<Flight[]> = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(
          data.error?.message ||
          (response.status === 404
            ? 'No matching flight found. Please check the flight number, airline, or date.'
            : 'Unable to retrieve flight information. Please try again later.')
        );
      }

      return data.data || [];
    } catch (err: any) {
      if (err.name === 'AbortError') {
        throw err;
      }
      throw new Error(err.message || 'Unable to retrieve flight information. Please try again later.');
    }
  }

  /**
   * Fetch single flight details by flight number
   */
  public static async getFlightDetails(
    flightNumber: string,
    date?: string,
    signal?: AbortSignal
  ): Promise<Flight> {
    const params = new URLSearchParams();
    if (date) params.append('flightDate', date);

    const query = params.toString() ? `?${params.toString()}` : '';
const endpoint = `${BASE_URL}/api/flights/${encodeURIComponent(flightNumber.trim().toUpperCase())}${query}`;

    try {
      const response = await fetch(endpoint, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        signal,
      });

      const data: ApiResponse<Flight> = await response.json();

      if (!response.ok || !data.success || !data.data) {
        const error: any = new Error(
          data.error?.message ||
          'No matching flight found. Please check the flight number, airline, or date.'
        );
        error.code = data.error?.code;
        throw error;
      }

      return data.data;
    } catch (err: any) {
      if (err.name === 'AbortError') {
        throw err;
      }
      const error: any = new Error(err.message || 'Unable to retrieve flight information. Please try again later.');
      error.code = err.code;
      throw error;
    }
  }
}
