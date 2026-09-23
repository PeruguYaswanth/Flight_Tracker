export interface AirportCoordinate {
  iata: string;
  name: string;
  city: string;
  country: string;
  lat: number;
  lng: number;
}

// Static reference geodata for major airports (public airport locations,
// not flight-specific data). The configured Aviationstack plan does not
// return airport coordinates in /flights responses and its /airports
// endpoint is plan-restricted (function_access_restricted), so this table
// is the only source of departure/arrival coordinates for the map. It is
// intentionally broad to cover common real-world routes; airports not
// listed here simply have no map pin/route, which is reported honestly
// rather than guessed at.
export const AIRPORT_COORDINATES: Record<string, AirportCoordinate> = {
  // India
  HYD: { iata: 'HYD', name: 'Rajiv Gandhi International Airport', city: 'Hyderabad', country: 'India', lat: 17.2403, lng: 78.4294 },
  DEL: { iata: 'DEL', name: 'Indira Gandhi International Airport', city: 'Delhi', country: 'India', lat: 28.5562, lng: 77.1000 },
  BOM: { iata: 'BOM', name: 'Chhatrapati Shivaji Maharaj International Airport', city: 'Mumbai', country: 'India', lat: 19.0896, lng: 72.8656 },
  BLR: { iata: 'BLR', name: 'Kempegowda International Airport', city: 'Bengaluru', country: 'India', lat: 13.1986, lng: 77.7066 },
  MAA: { iata: 'MAA', name: 'Chennai International Airport', city: 'Chennai', country: 'India', lat: 12.9941, lng: 80.1709 },
  CCU: { iata: 'CCU', name: 'Netaji Subhash Chandra Bose International Airport', city: 'Kolkata', country: 'India', lat: 22.6547, lng: 88.4467 },
  GOI: { iata: 'GOI', name: 'Dabolim Airport', city: 'Goa', country: 'India', lat: 15.3808, lng: 73.8314 },
  COK: { iata: 'COK', name: 'Cochin International Airport', city: 'Kochi', country: 'India', lat: 10.1520, lng: 76.4019 },
  AMD: { iata: 'AMD', name: 'Sardar Vallabhbhai Patel International Airport', city: 'Ahmedabad', country: 'India', lat: 23.0772, lng: 72.6347 },
  PNQ: { iata: 'PNQ', name: 'Pune Airport', city: 'Pune', country: 'India', lat: 18.5822, lng: 73.9197 },
  JAI: { iata: 'JAI', name: 'Jaipur International Airport', city: 'Jaipur', country: 'India', lat: 26.8242, lng: 75.8122 },
  LKO: { iata: 'LKO', name: 'Chaudhary Charan Singh International Airport', city: 'Lucknow', country: 'India', lat: 26.7606, lng: 80.8893 },
  IXC: { iata: 'IXC', name: 'Chandigarh Airport', city: 'Chandigarh', country: 'India', lat: 30.6735, lng: 76.7885 },
  VNS: { iata: 'VNS', name: 'Lal Bahadur Shastri Airport', city: 'Varanasi', country: 'India', lat: 25.4524, lng: 82.8593 },
  ATQ: { iata: 'ATQ', name: 'Sri Guru Ram Dass Jee International Airport', city: 'Amritsar', country: 'India', lat: 31.7096, lng: 74.7973 },
  TRV: { iata: 'TRV', name: 'Trivandrum International Airport', city: 'Thiruvananthapuram', country: 'India', lat: 8.4821, lng: 76.9200 },
  IXB: { iata: 'IXB', name: 'Bagdogra Airport', city: 'Siliguri', country: 'India', lat: 26.6812, lng: 88.3286 },

  // Middle East
  DXB: { iata: 'DXB', name: 'Dubai International Airport', city: 'Dubai', country: 'United Arab Emirates', lat: 25.2532, lng: 55.3657 },
  DOH: { iata: 'DOH', name: 'Hamad International Airport', city: 'Doha', country: 'Qatar', lat: 25.2731, lng: 51.6081 },
  AUH: { iata: 'AUH', name: 'Zayed International Airport', city: 'Abu Dhabi', country: 'United Arab Emirates', lat: 24.4330, lng: 54.6511 },
  JED: { iata: 'JED', name: 'King Abdulaziz International Airport', city: 'Jeddah', country: 'Saudi Arabia', lat: 21.6796, lng: 39.1565 },
  RUH: { iata: 'RUH', name: 'King Khalid International Airport', city: 'Riyadh', country: 'Saudi Arabia', lat: 24.9576, lng: 46.6988 },
  KWI: { iata: 'KWI', name: 'Kuwait International Airport', city: 'Kuwait City', country: 'Kuwait', lat: 29.2266, lng: 47.9689 },
  MCT: { iata: 'MCT', name: 'Muscat International Airport', city: 'Muscat', country: 'Oman', lat: 23.5933, lng: 58.2844 },
  BAH: { iata: 'BAH', name: 'Bahrain International Airport', city: 'Manama', country: 'Bahrain', lat: 26.2708, lng: 50.6336 },
  AMM: { iata: 'AMM', name: 'Queen Alia International Airport', city: 'Amman', country: 'Jordan', lat: 31.7226, lng: 35.9932 },
  TLV: { iata: 'TLV', name: 'Ben Gurion Airport', city: 'Tel Aviv', country: 'Israel', lat: 32.0114, lng: 34.8867 },
  CAI: { iata: 'CAI', name: 'Cairo International Airport', city: 'Cairo', country: 'Egypt', lat: 30.1219, lng: 31.4056 },
  IST: { iata: 'IST', name: 'Istanbul Airport', city: 'Istanbul', country: 'Turkey', lat: 41.2753, lng: 28.7519 },

  // East / Southeast Asia
  SIN: { iata: 'SIN', name: 'Singapore Changi Airport', city: 'Singapore', country: 'Singapore', lat: 1.3644, lng: 103.9915 },
  BKK: { iata: 'BKK', name: 'Suvarnabhumi Airport', city: 'Bangkok', country: 'Thailand', lat: 13.6900, lng: 100.7501 },
  KUL: { iata: 'KUL', name: 'Kuala Lumpur International Airport', city: 'Kuala Lumpur', country: 'Malaysia', lat: 2.7456, lng: 101.7099 },
  HKG: { iata: 'HKG', name: 'Hong Kong International Airport', city: 'Hong Kong', country: 'Hong Kong', lat: 22.3080, lng: 113.9185 },
  ICN: { iata: 'ICN', name: 'Incheon International Airport', city: 'Seoul', country: 'South Korea', lat: 37.4602, lng: 126.4407 },
  PEK: { iata: 'PEK', name: 'Beijing Capital International Airport', city: 'Beijing', country: 'China', lat: 40.0801, lng: 116.5846 },
  PVG: { iata: 'PVG', name: 'Shanghai Pudong International Airport', city: 'Shanghai', country: 'China', lat: 31.1443, lng: 121.8083 },
  TPE: { iata: 'TPE', name: 'Taiwan Taoyuan International Airport', city: 'Taipei', country: 'Taiwan', lat: 25.0777, lng: 121.2328 },
  MNL: { iata: 'MNL', name: 'Ninoy Aquino International Airport', city: 'Manila', country: 'Philippines', lat: 14.5086, lng: 121.0198 },
  CGK: { iata: 'CGK', name: 'Soekarno-Hatta International Airport', city: 'Jakarta', country: 'Indonesia', lat: -6.1256, lng: 106.6559 },
  DPS: { iata: 'DPS', name: 'Ngurah Rai International Airport', city: 'Denpasar (Bali)', country: 'Indonesia', lat: -8.7482, lng: 115.1671 },
  SGN: { iata: 'SGN', name: 'Tan Son Nhat International Airport', city: 'Ho Chi Minh City', country: 'Vietnam', lat: 10.8188, lng: 106.6520 },
  HAN: { iata: 'HAN', name: 'Noi Bai International Airport', city: 'Hanoi', country: 'Vietnam', lat: 21.2212, lng: 105.8072 },
  RGN: { iata: 'RGN', name: 'Yangon International Airport', city: 'Yangon', country: 'Myanmar', lat: 16.9073, lng: 96.1332 },
  HND: { iata: 'HND', name: 'Tokyo Haneda Airport', city: 'Tokyo', country: 'Japan', lat: 35.5494, lng: 139.7798 },
  NRT: { iata: 'NRT', name: 'Narita International Airport', city: 'Tokyo', country: 'Japan', lat: 35.7720, lng: 140.3929 },
  KIX: { iata: 'KIX', name: 'Kansai International Airport', city: 'Osaka', country: 'Japan', lat: 34.4347, lng: 135.2440 },

  // Europe
  LHR: { iata: 'LHR', name: 'London Heathrow Airport', city: 'London', country: 'United Kingdom', lat: 51.4700, lng: -0.4543 },
  LGW: { iata: 'LGW', name: 'London Gatwick Airport', city: 'London', country: 'United Kingdom', lat: 51.1537, lng: -0.1821 },
  MAN: { iata: 'MAN', name: 'Manchester Airport', city: 'Manchester', country: 'United Kingdom', lat: 53.3537, lng: -2.2750 },
  EDI: { iata: 'EDI', name: 'Edinburgh Airport', city: 'Edinburgh', country: 'United Kingdom', lat: 55.9500, lng: -3.3725 },
  DUB: { iata: 'DUB', name: 'Dublin Airport', city: 'Dublin', country: 'Ireland', lat: 53.4213, lng: -6.2701 },
  CDG: { iata: 'CDG', name: 'Charles de Gaulle Airport', city: 'Paris', country: 'France', lat: 49.0097, lng: 2.5479 },
  NCE: { iata: 'NCE', name: "Nice Côte d'Azur Airport", city: 'Nice', country: 'France', lat: 43.6584, lng: 7.2159 },
  FRA: { iata: 'FRA', name: 'Frankfurt Airport', city: 'Frankfurt', country: 'Germany', lat: 50.0379, lng: 8.5622 },
  MUC: { iata: 'MUC', name: 'Munich Airport', city: 'Munich', country: 'Germany', lat: 48.3538, lng: 11.7861 },
  BER: { iata: 'BER', name: 'Berlin Brandenburg Airport', city: 'Berlin', country: 'Germany', lat: 52.3667, lng: 13.5033 },
  ZRH: { iata: 'ZRH', name: 'Zurich Airport', city: 'Zurich', country: 'Switzerland', lat: 47.4647, lng: 8.5492 },
  GVA: { iata: 'GVA', name: 'Geneva Airport', city: 'Geneva', country: 'Switzerland', lat: 46.2381, lng: 6.1090 },
  VIE: { iata: 'VIE', name: 'Vienna International Airport', city: 'Vienna', country: 'Austria', lat: 48.1103, lng: 16.5697 },
  AMS: { iata: 'AMS', name: 'Amsterdam Airport Schiphol', city: 'Amsterdam', country: 'Netherlands', lat: 52.3105, lng: 4.7683 },
  BRU: { iata: 'BRU', name: 'Brussels Airport', city: 'Brussels', country: 'Belgium', lat: 50.9014, lng: 4.4844 },
  MAD: { iata: 'MAD', name: 'Adolfo Suárez Madrid–Barajas Airport', city: 'Madrid', country: 'Spain', lat: 40.4983, lng: -3.5676 },
  BCN: { iata: 'BCN', name: 'Josep Tarradellas Barcelona-El Prat Airport', city: 'Barcelona', country: 'Spain', lat: 41.2971, lng: 2.0785 },
  FCO: { iata: 'FCO', name: 'Leonardo da Vinci–Fiumicino Airport', city: 'Rome', country: 'Italy', lat: 41.8003, lng: 12.2389 },
  MXP: { iata: 'MXP', name: 'Milan Malpensa Airport', city: 'Milan', country: 'Italy', lat: 45.6306, lng: 8.7281 },
  LIS: { iata: 'LIS', name: 'Humberto Delgado Airport', city: 'Lisbon', country: 'Portugal', lat: 38.7756, lng: -9.1354 },
  CPH: { iata: 'CPH', name: 'Copenhagen Airport', city: 'Copenhagen', country: 'Denmark', lat: 55.6180, lng: 12.6560 },
  OSL: { iata: 'OSL', name: 'Oslo Airport', city: 'Oslo', country: 'Norway', lat: 60.1976, lng: 11.1004 },
  ARN: { iata: 'ARN', name: 'Stockholm Arlanda Airport', city: 'Stockholm', country: 'Sweden', lat: 59.6519, lng: 17.9186 },
  HEL: { iata: 'HEL', name: 'Helsinki-Vantaa Airport', city: 'Helsinki', country: 'Finland', lat: 60.3172, lng: 24.9633 },
  WAW: { iata: 'WAW', name: 'Warsaw Chopin Airport', city: 'Warsaw', country: 'Poland', lat: 52.1657, lng: 20.9671 },
  PRG: { iata: 'PRG', name: 'Václav Havel Airport Prague', city: 'Prague', country: 'Czech Republic', lat: 50.1008, lng: 14.2600 },
  BUD: { iata: 'BUD', name: 'Budapest Ferenc Liszt International Airport', city: 'Budapest', country: 'Hungary', lat: 47.4298, lng: 19.2611 },
  ATH: { iata: 'ATH', name: 'Athens International Airport', city: 'Athens', country: 'Greece', lat: 37.9364, lng: 23.9445 },

  // North America
  JFK: { iata: 'JFK', name: 'John F. Kennedy International Airport', city: 'New York', country: 'United States', lat: 40.6413, lng: -73.7781 },
  EWR: { iata: 'EWR', name: 'Newark Liberty International Airport', city: 'Newark', country: 'United States', lat: 40.6895, lng: -74.1745 },
  LAX: { iata: 'LAX', name: 'Los Angeles International Airport', city: 'Los Angeles', country: 'United States', lat: 33.9416, lng: -118.4085 },
  SFO: { iata: 'SFO', name: 'San Francisco International Airport', city: 'San Francisco', country: 'United States', lat: 37.6213, lng: -122.3790 },
  ORD: { iata: 'ORD', name: "O'Hare International Airport", city: 'Chicago', country: 'United States', lat: 41.9742, lng: -87.9073 },
  ATL: { iata: 'ATL', name: 'Hartsfield-Jackson Atlanta International Airport', city: 'Atlanta', country: 'United States', lat: 33.6407, lng: -84.4277 },
  DFW: { iata: 'DFW', name: 'Dallas/Fort Worth International Airport', city: 'Dallas', country: 'United States', lat: 32.8998, lng: -97.0403 },
  DEN: { iata: 'DEN', name: 'Denver International Airport', city: 'Denver', country: 'United States', lat: 39.8561, lng: -104.6737 },
  SEA: { iata: 'SEA', name: 'Seattle–Tacoma International Airport', city: 'Seattle', country: 'United States', lat: 47.4502, lng: -122.3088 },
  MIA: { iata: 'MIA', name: 'Miami International Airport', city: 'Miami', country: 'United States', lat: 25.7959, lng: -80.2870 },
  IAH: { iata: 'IAH', name: 'George Bush Intercontinental Airport', city: 'Houston', country: 'United States', lat: 29.9902, lng: -95.3368 },
  BOS: { iata: 'BOS', name: 'Logan International Airport', city: 'Boston', country: 'United States', lat: 42.3656, lng: -71.0096 },
  IAD: { iata: 'IAD', name: 'Washington Dulles International Airport', city: 'Washington, D.C.', country: 'United States', lat: 38.9531, lng: -77.4565 },
  YYZ: { iata: 'YYZ', name: 'Toronto Pearson International Airport', city: 'Toronto', country: 'Canada', lat: 43.6777, lng: -79.6248 },
  YVR: { iata: 'YVR', name: 'Vancouver International Airport', city: 'Vancouver', country: 'Canada', lat: 49.1947, lng: -123.1792 },
  YUL: { iata: 'YUL', name: 'Montréal–Trudeau International Airport', city: 'Montreal', country: 'Canada', lat: 45.4706, lng: -73.7408 },
  MEX: { iata: 'MEX', name: 'Mexico City International Airport', city: 'Mexico City', country: 'Mexico', lat: 19.4363, lng: -99.0721 },
  CUN: { iata: 'CUN', name: 'Cancún International Airport', city: 'Cancún', country: 'Mexico', lat: 21.0365, lng: -86.8771 },

  // South America
  GRU: { iata: 'GRU', name: 'São Paulo/Guarulhos International Airport', city: 'São Paulo', country: 'Brazil', lat: -23.4356, lng: -46.4731 },
  GIG: { iata: 'GIG', name: 'Rio de Janeiro/Galeão International Airport', city: 'Rio de Janeiro', country: 'Brazil', lat: -22.8100, lng: -43.2506 },
  EZE: { iata: 'EZE', name: 'Ministro Pistarini International Airport', city: 'Buenos Aires', country: 'Argentina', lat: -34.8222, lng: -58.5358 },
  SCL: { iata: 'SCL', name: 'Arturo Merino Benítez International Airport', city: 'Santiago', country: 'Chile', lat: -33.3930, lng: -70.7858 },
  BOG: { iata: 'BOG', name: 'El Dorado International Airport', city: 'Bogotá', country: 'Colombia', lat: 4.7016, lng: -74.1469 },
  LIM: { iata: 'LIM', name: 'Jorge Chávez International Airport', city: 'Lima', country: 'Peru', lat: -12.0219, lng: -77.1143 },

  // Africa
  JNB: { iata: 'JNB', name: 'O.R. Tambo International Airport', city: 'Johannesburg', country: 'South Africa', lat: -26.1392, lng: 28.2460 },
  CPT: { iata: 'CPT', name: 'Cape Town International Airport', city: 'Cape Town', country: 'South Africa', lat: -33.9648, lng: 18.6017 },
  NBO: { iata: 'NBO', name: 'Jomo Kenyatta International Airport', city: 'Nairobi', country: 'Kenya', lat: -1.3192, lng: 36.9278 },
  ADD: { iata: 'ADD', name: 'Addis Ababa Bole International Airport', city: 'Addis Ababa', country: 'Ethiopia', lat: 8.9779, lng: 38.7993 },
  LOS: { iata: 'LOS', name: 'Murtala Muhammed International Airport', city: 'Lagos', country: 'Nigeria', lat: 6.5774, lng: 3.3212 },
  CMN: { iata: 'CMN', name: 'Mohammed V International Airport', city: 'Casablanca', country: 'Morocco', lat: 33.3675, lng: -7.5900 },
  ACC: { iata: 'ACC', name: 'Kotoka International Airport', city: 'Accra', country: 'Ghana', lat: 5.6052, lng: -0.1668 },

  // Oceania
  SYD: { iata: 'SYD', name: 'Sydney Kingsford Smith Airport', city: 'Sydney', country: 'Australia', lat: -33.9399, lng: 151.1753 },
  MEL: { iata: 'MEL', name: 'Melbourne Airport', city: 'Melbourne', country: 'Australia', lat: -37.6690, lng: 144.8410 },
  BNE: { iata: 'BNE', name: 'Brisbane Airport', city: 'Brisbane', country: 'Australia', lat: -27.3942, lng: 153.1218 },
  PER: { iata: 'PER', name: 'Perth Airport', city: 'Perth', country: 'Australia', lat: -31.9385, lng: 115.9672 },
  AKL: { iata: 'AKL', name: 'Auckland Airport', city: 'Auckland', country: 'New Zealand', lat: -37.0082, lng: 174.7850 },
};

export function getAirportCoords(iata?: string | null): AirportCoordinate | null {
  if (!iata) return null;
  const upper = iata.toUpperCase().trim();
  return AIRPORT_COORDINATES[upper] || null;
}
