import { Flight } from './flight';

export interface AirportSummary {
  iata: string;
  name: string;
  city: string;
  country: string;
  lat: number;
  lng: number;
}

export interface AirportDetails {
  airport: AirportSummary;
  departures: Flight[];
  arrivals: Flight[];
}
