export interface AirportRecord {
  iata: string;
  icao?: string;
  name: string;
  city: string;
  country: string;
  region?: string;
  aliases?: string[];
  lat?: number;
  lng?: number;
}

export const AIRPORT_DATABASE: AirportRecord[] = [
  // India - Major & Metro
  { iata: 'HYD', icao: 'VOHS', name: 'Rajiv Gandhi International Airport', city: 'Hyderabad', country: 'India', aliases: ['Shamshabad', 'Secunderabad', 'Telangana'], lat: 17.2403, lng: 78.4294 },
  { iata: 'DEL', icao: 'VIDP', name: 'Indira Gandhi International Airport', city: 'Delhi', country: 'India', aliases: ['New Delhi', 'NCR', 'Palam'], lat: 28.5562, lng: 77.1000 },
  { iata: 'BOM', icao: 'VABB', name: 'Chhatrapati Shivaji Maharaj International Airport', city: 'Mumbai', country: 'India', aliases: ['Bombay', 'Sahar', 'Maharashtra'], lat: 19.0896, lng: 72.8656 },
  { iata: 'BLR', icao: 'VOBL', name: 'Kempegowda International Airport', city: 'Bengaluru', country: 'India', aliases: ['Bangalore', 'Devanahalli', 'Karnataka'], lat: 13.1986, lng: 77.7066 },
  { iata: 'MAA', icao: 'VOMM', name: 'Chennai International Airport', city: 'Chennai', country: 'India', aliases: ['Madras', 'Meenambakkam', 'Tamil Nadu'], lat: 12.9941, lng: 80.1709 },
  { iata: 'CCU', icao: 'VECC', name: 'Netaji Subhash Chandra Bose International Airport', city: 'Kolkata', country: 'India', aliases: ['Calcutta', 'Dum Dum', 'West Bengal'], lat: 22.6547, lng: 88.4467 },
  { iata: 'GOI', icao: 'VOGO', name: 'Dabolim Airport', city: 'Goa', country: 'India', aliases: ['Dabolim', 'South Goa', 'Vasco da Gama'], lat: 15.3808, lng: 73.8314 },
  { iata: 'GOX', icao: 'VOGA', name: 'Manohar International Airport', city: 'Goa', country: 'India', aliases: ['Mopa', 'North Goa', 'Pernem'], lat: 15.7656, lng: 73.8647 },
  { iata: 'COK', icao: 'VOCI', name: 'Cochin International Airport', city: 'Kochi', country: 'India', aliases: ['Cochin', 'Nedumbassery', 'Kerala', 'Ernakulam'], lat: 10.1520, lng: 76.4019 },
  { iata: 'AMD', icao: 'VAAH', name: 'Sardar Vallabhbhai Patel International Airport', city: 'Ahmedabad', country: 'India', aliases: ['Ahmadabad', 'Gujarat', 'Hansol'], lat: 23.0772, lng: 72.6347 },
  { iata: 'PNQ', icao: 'VAPO', name: 'Pune Airport', city: 'Pune', country: 'India', aliases: ['Lohegaon', 'Poona', 'Maharashtra'], lat: 18.5822, lng: 73.9197 },
  { iata: 'JAI', icao: 'VIJP', name: 'Jaipur International Airport', city: 'Jaipur', country: 'India', aliases: ['Sanganer', 'Pink City', 'Rajasthan'], lat: 26.8242, lng: 75.8122 },
  { iata: 'LKO', icao: 'VILK', name: 'Chaudhary Charan Singh International Airport', city: 'Lucknow', country: 'India', aliases: ['Amausi', 'Uttar Pradesh', 'Awadh'], lat: 26.7606, lng: 80.8893 },
  { iata: 'IXC', icao: 'VICG', name: 'Chandigarh International Airport', city: 'Chandigarh', country: 'India', aliases: ['Mohali', 'Punjab', 'Haryana', 'Shaheed Bhagat Singh'], lat: 30.6735, lng: 76.7885 },
  { iata: 'VNS', icao: 'VEBN', name: 'Lal Bahadur Shastri Airport', city: 'Varanasi', country: 'India', aliases: ['Banaras', 'Benares', 'Babatpur', 'Kashi'], lat: 25.4524, lng: 82.8593 },
  { iata: 'ATQ', icao: 'VIAR', name: 'Sri Guru Ram Dass Jee International Airport', city: 'Amritsar', country: 'India', aliases: ['Rajasansi', 'Punjab', 'Golden Temple'], lat: 31.7096, lng: 74.7973 },
  { iata: 'TRV', icao: 'VOTV', name: 'Trivandrum International Airport', city: 'Thiruvananthapuram', country: 'India', aliases: ['Trivandrum', 'Kerala', 'Chacka'], lat: 8.4821, lng: 76.9200 },
  { iata: 'IXB', icao: 'VEBD', name: 'Bagdogra Airport', city: 'Siliguri', country: 'India', aliases: ['Bagdogra', 'Darjeeling', 'West Bengal', 'Sikkim'], lat: 26.6812, lng: 88.3286 },
  { iata: 'GAU', icao: 'VEGT', name: 'Lokpriya Gopinath Bordoloi International Airport', city: 'Guwahati', country: 'India', aliases: ['Borjhar', 'Assam', 'North East'], lat: 26.1061, lng: 91.5859 },
  { iata: 'BBI', icao: 'VEBS', name: 'Biju Patnaik International Airport', city: 'Bhubaneswar', country: 'India', aliases: ['Bhubaneshwar', 'Odisha', 'Orissa'], lat: 20.2444, lng: 85.8178 },
  { iata: 'PAT', icao: 'VEPT', name: 'Jay Prakash Narayan Airport', city: 'Patna', country: 'India', aliases: ['Bihar'], lat: 25.5913, lng: 85.0880 },
  { iata: 'IDR', icao: 'VAID', name: 'Devi Ahilyabai Holkar Airport', city: 'Indore', country: 'India', aliases: ['Madhya Pradesh'], lat: 22.7217, lng: 75.8011 },
  { iata: 'NAG', icao: 'VANP', name: 'Dr. Babasaheb Ambedkar International Airport', city: 'Nagpur', country: 'India', aliases: ['Sonegaon', 'Maharashtra', 'Vidarbha'], lat: 21.0922, lng: 79.0472 },
  { iata: 'VTZ', icao: 'VOVZ', name: 'Visakhapatnam International Airport', city: 'Visakhapatnam', country: 'India', aliases: ['Vizag', 'Andhra Pradesh'], lat: 17.7212, lng: 83.2245 },
  { iata: 'IXE', icao: 'VOML', name: 'Mangalore International Airport', city: 'Mangalore', country: 'India', aliases: ['Mangaluru', 'Bajpe', 'Karnataka'], lat: 12.9613, lng: 74.8901 },
  { iata: 'CJB', icao: 'VOCB', name: 'Coimbatore International Airport', city: 'Coimbatore', country: 'India', aliases: ['Peelamedu', 'Kovai', 'Tamil Nadu'], lat: 11.0299, lng: 77.0434 },
  { iata: 'TRZ', icao: 'VOTR', name: 'Tiruchirappalli International Airport', city: 'Tiruchirappalli', country: 'India', aliases: ['Trichy', 'Tamil Nadu'], lat: 10.7654, lng: 78.7097 },
  { iata: 'IXM', icao: 'VOMD', name: 'Madurai Airport', city: 'Madurai', country: 'India', aliases: ['Tamil Nadu'], lat: 9.8345, lng: 78.0934 },
  { iata: 'CCJ', icao: 'VOCL', name: 'Calicut International Airport', city: 'Kozhikode', country: 'India', aliases: ['Calicut', 'Karipur', 'Kerala', 'Malabar'], lat: 11.1368, lng: 75.9553 },
  { iata: 'CNN', icao: 'VOKN', name: 'Kannur International Airport', city: 'Kannur', country: 'India', aliases: ['Mattannur', 'Kerala'], lat: 11.9181, lng: 75.5481 },
  { iata: 'SXR', icao: 'VISR', name: 'Sheikh ul-Alam International Airport', city: 'Srinagar', country: 'India', aliases: ['Kashmir', 'Jammu and Kashmir'], lat: 33.9871, lng: 74.7741 },
  { iata: 'IXJ', icao: 'VIJU', name: 'Jammu Airport', city: 'Jammu', country: 'India', aliases: ['Satwari', 'Jammu and Kashmir'], lat: 32.6891, lng: 74.8374 },
  { iata: 'IXL', icao: 'VILH', name: 'Kushok Bakula Rimpochee Airport', city: 'Leh', country: 'India', aliases: ['Ladakh'], lat: 34.1359, lng: 77.5465 },
  { iata: 'BDQ', icao: 'VABO', name: 'Vadodara Airport', city: 'Vadodara', country: 'India', aliases: ['Baroda', 'Gujarat', 'Harni'], lat: 22.3362, lng: 73.2263 },
  { iata: 'STV', icao: 'VASU', name: 'Surat International Airport', city: 'Surat', country: 'India', aliases: ['Gujarat', 'Magdalla'], lat: 21.1141, lng: 72.7419 },
  { iata: 'RAJ', icao: 'VARK', name: 'Rajkot International Airport', city: 'Rajkot', country: 'India', aliases: ['Hirasar', 'Gujarat', 'Saurashtra'], lat: 22.3619, lng: 70.9856 },
  { iata: 'UDR', icao: 'VAUD', name: 'Maharana Pratap Airport', city: 'Udaipur', country: 'India', aliases: ['Dabok', 'Rajasthan', 'Mewar'], lat: 24.6178, lng: 73.8961 },
  { iata: 'JDH', icao: 'VIJO', name: 'Jodhpur Airport', city: 'Jodhpur', country: 'India', aliases: ['Rajasthan', 'Marwar'], lat: 26.2512, lng: 73.0489 },
  { iata: 'BHO', icao: 'VABP', name: 'Raja Bhoj Airport', city: 'Bhopal', country: 'India', aliases: ['Madhya Pradesh', 'Gandhi Nagar'], lat: 23.2875, lng: 77.3378 },
  { iata: 'RPR', icao: 'VARP', name: 'Swami Vivekananda Airport', city: 'Raipur', country: 'India', aliases: ['Mana', 'Chhattisgarh'], lat: 21.1804, lng: 81.7388 },
  { iata: 'IXR', icao: 'VERC', name: 'Birsa Munda Airport', city: 'Ranchi', country: 'India', aliases: ['Hinoo', 'Jharkhand'], lat: 23.3143, lng: 85.3217 },
  { iata: 'DED', icao: 'VIDN', name: 'Jolly Grant Airport', city: 'Dehradun', country: 'India', aliases: ['Uttarakhand', 'Rishikesh', 'Haridwar'], lat: 30.1897, lng: 78.1803 },
  { iata: 'TIR', icao: 'VOTP', name: 'Tirupati Airport', city: 'Tirupati', country: 'India', aliases: ['Renigunta', 'Andhra Pradesh', 'Balaji'], lat: 13.6325, lng: 79.5433 },
  { iata: 'VGA', icao: 'VOBZ', name: 'Vijayawada International Airport', city: 'Vijayawada', country: 'India', aliases: ['Gannavaram', 'Amaravati', 'Andhra Pradesh'], lat: 16.5304, lng: 80.7968 },
  { iata: 'RJA', icao: 'VORY', name: 'Rajahmundry Airport', city: 'Rajahmundry', country: 'India', aliases: ['Madhurapudi', 'Andhra Pradesh', 'Rajamahendravaram'], lat: 17.1104, lng: 81.8184 },
  { iata: 'AYJ', icao: 'VEAY', name: 'Maharishi Valmiki International Airport', city: 'Ayodhya', country: 'India', aliases: ['Faizabad', 'Uttar Pradesh', 'Ram Mandir'], lat: 26.7461, lng: 82.1558 },

  // Middle East
  { iata: 'DXB', icao: 'OMDB', name: 'Dubai International Airport', city: 'Dubai', country: 'United Arab Emirates', aliases: ['UAE', 'Emirates'], lat: 25.2532, lng: 55.3657 },
  { iata: 'DWC', icao: 'OMDW', name: 'Al Maktoum International Airport', city: 'Dubai', country: 'United Arab Emirates', aliases: ['Dubai World Central', 'Jebel Ali'], lat: 24.8960, lng: 55.1614 },
  { iata: 'DOH', icao: 'OTHH', name: 'Hamad International Airport', city: 'Doha', country: 'Qatar', aliases: ['Qatar Airways'], lat: 25.2731, lng: 51.6081 },
  { iata: 'AUH', icao: 'OMAA', name: 'Zayed International Airport', city: 'Abu Dhabi', country: 'United Arab Emirates', aliases: ['Etihad', 'UAE'], lat: 24.4330, lng: 54.6511 },
  { iata: 'SHJ', icao: 'OMSJ', name: 'Sharjah International Airport', city: 'Sharjah', country: 'United Arab Emirates', aliases: ['Air Arabia'], lat: 25.3286, lng: 55.5172 },
  { iata: 'JED', icao: 'OEJN', name: 'King Abdulaziz International Airport', city: 'Jeddah', country: 'Saudi Arabia', aliases: ['Makkah', 'Mecca', 'Saudia'], lat: 21.6796, lng: 39.1565 },
  { iata: 'RUH', icao: 'OERK', name: 'King Khalid International Airport', city: 'Riyadh', country: 'Saudi Arabia', aliases: ['KSA'], lat: 24.9576, lng: 46.6988 },
  { iata: 'DMM', icao: 'OEDF', name: 'King Fahd International Airport', city: 'Dammam', country: 'Saudi Arabia', aliases: ['Dhahran', 'Khobar'], lat: 26.4712, lng: 49.7978 },
  { iata: 'MED', icao: 'OEMA', name: 'Prince Mohammad Bin Abdulaziz International Airport', city: 'Medina', country: 'Saudi Arabia', aliases: ['Madinah'], lat: 24.5534, lng: 39.7051 },
  { iata: 'KWI', icao: 'OKBK', name: 'Kuwait International Airport', city: 'Kuwait City', country: 'Kuwait', aliases: ['Kuwait'], lat: 29.2266, lng: 47.9689 },
  { iata: 'MCT', icao: 'OOMS', name: 'Muscat International Airport', city: 'Muscat', country: 'Oman', aliases: ['Seeb', 'Oman Air'], lat: 23.5933, lng: 58.2844 },
  { iata: 'BAH', icao: 'OBBI', name: 'Bahrain International Airport', city: 'Manama', country: 'Bahrain', aliases: ['Gulf Air', 'Muharraq'], lat: 26.2708, lng: 50.6336 },
  { iata: 'AMM', icao: 'OJAI', name: 'Queen Alia International Airport', city: 'Amman', country: 'Jordan', aliases: ['Royal Jordanian'], lat: 31.7226, lng: 35.9932 },
  { iata: 'TLV', icao: 'LLBG', name: 'Ben Gurion Airport', city: 'Tel Aviv', country: 'Israel', aliases: ['Lod', 'El Al'], lat: 32.0114, lng: 34.8867 },
  { iata: 'CAI', icao: 'HECA', name: 'Cairo International Airport', city: 'Cairo', country: 'Egypt', aliases: ['EgyptAir', 'Giza'], lat: 30.1219, lng: 31.4056 },
  { iata: 'IST', icao: 'LTFM', name: 'Istanbul Airport', city: 'Istanbul', country: 'Turkey', aliases: ['Turkish Airlines', 'Arnavutkoy'], lat: 41.2753, lng: 28.7519 },
  { iata: 'SAW', icao: 'LTFJ', name: 'Sabiha Gokcen International Airport', city: 'Istanbul', country: 'Turkey', aliases: ['Pegasus', 'Anatolian'], lat: 40.8986, lng: 29.3092 },

  // Asia - East & Southeast
  { iata: 'SIN', icao: 'WSSS', name: 'Singapore Changi Airport', city: 'Singapore', country: 'Singapore', aliases: ['Changi', 'Singapore Airlines'], lat: 1.3644, lng: 103.9915 },
  { iata: 'BKK', icao: 'VTBS', name: 'Suvarnabhumi Airport', city: 'Bangkok', country: 'Thailand', aliases: ['Bangkok International', 'Thai Airways'], lat: 13.6900, lng: 100.7501 },
  { iata: 'DMK', icao: 'VTBD', name: 'Don Mueang International Airport', city: 'Bangkok', country: 'Thailand', aliases: ['AirAsia Thailand'], lat: 13.9126, lng: 100.6068 },
  { iata: 'HKT', icao: 'VTSP', name: 'Phuket International Airport', city: 'Phuket', country: 'Thailand', aliases: ['Phuket Island'], lat: 8.1132, lng: 98.3169 },
  { iata: 'KUL', icao: 'WMKK', name: 'Kuala Lumpur International Airport', city: 'Kuala Lumpur', country: 'Malaysia', aliases: ['KLIA', 'KLIA2', 'Sepang'], lat: 2.7456, lng: 101.7099 },
  { iata: 'HKG', icao: 'VHHH', name: 'Hong Kong International Airport', city: 'Hong Kong', country: 'Hong Kong', aliases: ['Chek Lap Kok', 'Cathay Pacific'], lat: 22.3080, lng: 113.9185 },
  { iata: 'ICN', icao: 'RKSI', name: 'Incheon International Airport', city: 'Seoul', country: 'South Korea', aliases: ['Incheon', 'Korean Air', 'Asiana'], lat: 37.4602, lng: 126.4407 },
  { iata: 'GMP', icao: 'RKSS', name: 'Gimpo International Airport', city: 'Seoul', country: 'South Korea', aliases: ['Gimpo'], lat: 37.5583, lng: 126.7906 },
  { iata: 'HND', icao: 'RJTT', name: 'Tokyo Haneda Airport', city: 'Tokyo', country: 'Japan', aliases: ['Haneda', 'Tokyo International', 'ANA', 'JAL'], lat: 35.5494, lng: 139.7798 },
  { iata: 'NRT', icao: 'RJAA', name: 'Narita International Airport', city: 'Tokyo', country: 'Japan', aliases: ['Narita', 'Chiba'], lat: 35.7720, lng: 140.3929 },
  { iata: 'KIX', icao: 'RJBB', name: 'Kansai International Airport', city: 'Osaka', country: 'Japan', aliases: ['Kansai', 'Kyoto'], lat: 34.4347, lng: 135.2440 },
  { iata: 'PEK', icao: 'ZBAA', name: 'Beijing Capital International Airport', city: 'Beijing', country: 'China', aliases: ['Air China', 'Peking'], lat: 40.0801, lng: 116.5846 },
  { iata: 'PKX', icao: 'ZBAD', name: 'Beijing Daxing International Airport', city: 'Beijing', country: 'China', aliases: ['Daxing'], lat: 39.5098, lng: 116.4105 },
  { iata: 'PVG', icao: 'ZSPD', name: 'Shanghai Pudong International Airport', city: 'Shanghai', country: 'China', aliases: ['Pudong', 'China Eastern'], lat: 31.1443, lng: 121.8083 },
  { iata: 'SHA', icao: 'ZSSS', name: 'Shanghai Hongqiao International Airport', city: 'Shanghai', country: 'China', aliases: ['Hongqiao'], lat: 31.1979, lng: 121.3363 },
  { iata: 'CAN', icao: 'ZGGG', name: 'Guangzhou Baiyun International Airport', city: 'Guangzhou', country: 'China', aliases: ['Canton', 'Baiyun', 'China Southern'], lat: 23.3924, lng: 113.2988 },
  { iata: 'SZX', icao: 'ZGSZ', name: 'Shenzhen Baoan International Airport', city: 'Shenzhen', country: 'China', aliases: ['Baoan'], lat: 22.6393, lng: 113.8107 },
  { iata: 'TPE', icao: 'RCTP', name: 'Taiwan Taoyuan International Airport', city: 'Taipei', country: 'Taiwan', aliases: ['Taoyuan', 'EVA Air', 'China Airlines'], lat: 25.0777, lng: 121.2328 },
  { iata: 'MNL', icao: 'RPLL', name: 'Ninoy Aquino International Airport', city: 'Manila', country: 'Philippines', aliases: ['NAIA', 'Philippine Airlines'], lat: 14.5086, lng: 121.0198 },
  { iata: 'CGK', icao: 'WIII', name: 'Soekarno-Hatta International Airport', city: 'Jakarta', country: 'Indonesia', aliases: ['Cengkareng', 'Garuda Indonesia'], lat: -6.1256, lng: 106.6559 },
  { iata: 'DPS', icao: 'WADD', name: 'Ngurah Rai International Airport', city: 'Denpasar', country: 'Indonesia', aliases: ['Bali', 'Kuta'], lat: -8.7482, lng: 115.1671 },
  { iata: 'SGN', icao: 'VVTS', name: 'Tan Son Nhat International Airport', city: 'Ho Chi Minh City', country: 'Vietnam', aliases: ['Saigon', 'Vietnam Airlines'], lat: 10.8188, lng: 106.6520 },
  { iata: 'HAN', icao: 'VVNB', name: 'Noi Bai International Airport', city: 'Hanoi', country: 'Vietnam', aliases: ['Noi Bai'], lat: 21.2212, lng: 105.8072 },
  { iata: 'CMB', icao: 'VCBI', name: 'Bandaranaike International Airport', city: 'Colombo', country: 'Sri Lanka', aliases: ['Katunayake', 'SriLankan Airlines'], lat: 7.1808, lng: 79.8841 },
  { iata: 'MLE', icao: 'VRMM', name: 'Velana International Airport', city: 'Male', country: 'Maldives', aliases: ['Hulhule', 'Maldives'], lat: 4.1918, lng: 73.5290 },
  { iata: 'KTM', icao: 'VNKT', name: 'Tribhuvan International Airport', city: 'Kathmandu', country: 'Nepal', aliases: ['Nepal', 'Himalayas'], lat: 27.6966, lng: 85.3591 },
  { iata: 'DAC', icao: 'VGHS', name: 'Hazrat Shahjalal International Airport', city: 'Dhaka', country: 'Bangladesh', aliases: ['Biman Bangladesh', 'Zia'], lat: 23.8433, lng: 90.3978 },

  // Europe - UK & Western
  { iata: 'LHR', icao: 'EGLL', name: 'London Heathrow Airport', city: 'London', country: 'United Kingdom', aliases: ['Heathrow', 'British Airways', 'England'], lat: 51.4700, lng: -0.4543 },
  { iata: 'LGW', icao: 'EGKK', name: 'London Gatwick Airport', city: 'London', country: 'United Kingdom', aliases: ['Gatwick', 'Sussex'], lat: 51.1537, lng: -0.1821 },
  { iata: 'STN', icao: 'EGSS', name: 'London Stansted Airport', city: 'London', country: 'United Kingdom', aliases: ['Stansted', 'Ryanair UK'], lat: 51.8860, lng: 0.2389 },
  { iata: 'LTN', icao: 'EGGW', name: 'London Luton Airport', city: 'London', country: 'United Kingdom', aliases: ['Luton', 'easyJet'], lat: 51.8747, lng: -0.3683 },
  { iata: 'LCY', icao: 'EGLC', name: 'London City Airport', city: 'London', country: 'United Kingdom', aliases: ['Docklands'], lat: 51.5053, lng: 0.0553 },
  { iata: 'MAN', icao: 'EGCC', name: 'Manchester Airport', city: 'Manchester', country: 'United Kingdom', aliases: ['Ringway', 'North West England'], lat: 53.3537, lng: -2.2750 },
  { iata: 'EDI', icao: 'EGPH', name: 'Edinburgh Airport', city: 'Edinburgh', country: 'United Kingdom', aliases: ['Scotland', 'Turnhouse'], lat: 55.9500, lng: -3.3725 },
  { iata: 'GLA', icao: 'EGPF', name: 'Glasgow Airport', city: 'Glasgow', country: 'United Kingdom', aliases: ['Abbotsinch', 'Scotland'], lat: 55.8719, lng: -4.4331 },
  { iata: 'BHX', icao: 'EGBB', name: 'Birmingham Airport', city: 'Birmingham', country: 'United Kingdom', aliases: ['West Midlands', 'Elmdon'], lat: 52.4539, lng: -1.7480 },
  { iata: 'DUB', icao: 'EIDW', name: 'Dublin Airport', city: 'Dublin', country: 'Ireland', aliases: ['Aer Lingus', 'Collinstown'], lat: 53.4213, lng: -6.2701 },
  { iata: 'CDG', icao: 'LFPG', name: 'Charles de Gaulle Airport', city: 'Paris', country: 'France', aliases: ['Roissy', 'Air France'], lat: 49.0097, lng: 2.5479 },
  { iata: 'ORY', icao: 'LFPO', name: 'Paris Orly Airport', city: 'Paris', country: 'France', aliases: ['Orly'], lat: 48.7262, lng: 2.3652 },
  { iata: 'NCE', icao: 'LFMN', name: "Nice Cote d'Azur Airport", city: 'Nice', country: 'France', aliases: ['French Riviera', 'Cannes', 'Monaco'], lat: 43.6584, lng: 7.2159 },
  { iata: 'FRA', icao: 'EDDF', name: 'Frankfurt Airport', city: 'Frankfurt', country: 'Germany', aliases: ['Frankfurt am Main', 'Lufthansa Hub'], lat: 50.0379, lng: 8.5622 },
  { iata: 'MUC', icao: 'EDDM', name: 'Munich Airport', city: 'Munich', country: 'Germany', aliases: ['Muenchen', 'Franz Josef Strauss', 'Bavaria'], lat: 48.3538, lng: 11.7861 },
  { iata: 'BER', icao: 'EDDB', name: 'Berlin Brandenburg Airport', city: 'Berlin', country: 'Germany', aliases: ['Willy Brandt', 'Schoenefeld'], lat: 52.3667, lng: 13.5033 },
  { iata: 'HAM', icao: 'EDDH', name: 'Hamburg Airport', city: 'Hamburg', country: 'Germany', aliases: ['Fuhlsbuettel'], lat: 53.6304, lng: 9.9882 },
  { iata: 'DUS', icao: 'EDDL', name: 'Dusseldorf Airport', city: 'Dusseldorf', country: 'Germany', aliases: ['Rhine-Ruhr'], lat: 51.2895, lng: 6.7668 },
  { iata: 'AMS', icao: 'EHAM', name: 'Amsterdam Airport Schiphol', city: 'Amsterdam', country: 'Netherlands', aliases: ['Schiphol', 'KLM'], lat: 52.3105, lng: 4.7683 },
  { iata: 'BRU', icao: 'EBBR', name: 'Brussels Airport', city: 'Brussels', country: 'Belgium', aliases: ['Zaventem', 'Brussels Airlines'], lat: 50.9014, lng: 4.4844 },
  { iata: 'ZRH', icao: 'LSZH', name: 'Zurich Airport', city: 'Zurich', country: 'Switzerland', aliases: ['Kloten', 'Swiss International'], lat: 47.4647, lng: 8.5492 },
  { iata: 'GVA', icao: 'LSGG', name: 'Geneva Airport', city: 'Geneva', country: 'Switzerland', aliases: ['Cointrin'], lat: 46.2381, lng: 6.1090 },
  { iata: 'VIE', icao: 'LOWW', name: 'Vienna International Airport', city: 'Vienna', country: 'Austria', aliases: ['Schwechat', 'Austrian Airlines'], lat: 48.1103, lng: 16.5697 },
  { iata: 'MAD', icao: 'LEMD', name: 'Adolfo Suarez Madrid-Barajas Airport', city: 'Madrid', country: 'Spain', aliases: ['Barajas', 'Iberia'], lat: 40.4983, lng: -3.5676 },
  { iata: 'BCN', icao: 'LEBL', name: 'Josep Tarradellas Barcelona-El Prat Airport', city: 'Barcelona', country: 'Spain', aliases: ['El Prat', 'Catalonia', 'Vueling'], lat: 41.2971, lng: 2.0785 },
  { iata: 'AGP', icao: 'LEMG', name: 'Malaga-Costa del Sol Airport', city: 'Malaga', country: 'Spain', aliases: ['Costa del Sol', 'Andalusia'], lat: 36.6749, lng: -4.4991 },
  { iata: 'FCO', icao: 'LIRF', name: 'Leonardo da Vinci-Fiumicino Airport', city: 'Rome', country: 'Italy', aliases: ['Fiumicino', 'ITA Airways', 'Roma'], lat: 41.8003, lng: 12.2389 },
  { iata: 'MXP', icao: 'LIMC', name: 'Milan Malpensa Airport', city: 'Milan', country: 'Italy', aliases: ['Malpensa', 'Milano'], lat: 45.6306, lng: 8.7281 },
  { iata: 'LIN', icao: 'LIML', name: 'Milan Linate Airport', city: 'Milan', country: 'Italy', aliases: ['Linate'], lat: 45.4451, lng: 9.2767 },
  { iata: 'LIS', icao: 'LPPT', name: 'Humberto Delgado Airport', city: 'Lisbon', country: 'Portugal', aliases: ['Portela', 'TAP Portugal'], lat: 38.7756, lng: -9.1354 },
  { iata: 'OPO', icao: 'LPPR', name: 'Francisco Sa Carneiro Airport', city: 'Porto', country: 'Portugal', aliases: ['Pedras Rubras'], lat: 41.2421, lng: -8.6814 },
  { iata: 'ATH', icao: 'LGAV', name: 'Athens International Airport', city: 'Athens', country: 'Greece', aliases: ['Eleftherios Venizelos', 'Aegean'], lat: 37.9364, lng: 23.9445 },
  { iata: 'CPH', icao: 'EKCH', name: 'Copenhagen Airport', city: 'Copenhagen', country: 'Denmark', aliases: ['Kastrup', 'SAS'], lat: 55.6180, lng: 12.6560 },
  { iata: 'OSL', icao: 'ENGM', name: 'Oslo Airport', city: 'Oslo', country: 'Norway', aliases: ['Gardermoen', 'Norwegian'], lat: 60.1976, lng: 11.1004 },
  { iata: 'ARN', icao: 'ESSA', name: 'Stockholm Arlanda Airport', city: 'Stockholm', country: 'Sweden', aliases: ['Arlanda'], lat: 59.6519, lng: 17.9186 },
  { iata: 'HEL', icao: 'EFHK', name: 'Helsinki-Vantaa Airport', city: 'Helsinki', country: 'Finland', aliases: ['Vantaa', 'Finnair'], lat: 60.3172, lng: 24.9633 },
  { iata: 'WAW', icao: 'EPWA', name: 'Warsaw Chopin Airport', city: 'Warsaw', country: 'Poland', aliases: ['Okecie', 'LOT Polish Airlines'], lat: 52.1657, lng: 20.9671 },
  { iata: 'PRG', icao: 'LKPR', name: 'Vaclav Havel Airport Prague', city: 'Prague', country: 'Czech Republic', aliases: ['Ruzyne'], lat: 50.1008, lng: 14.2600 },
  { iata: 'BUD', icao: 'LHBP', name: 'Budapest Ferenc Liszt International Airport', city: 'Budapest', country: 'Hungary', aliases: ['Ferihegy', 'Wizz Air'], lat: 47.4298, lng: 19.2611 },

  // North America - USA & Canada
  { iata: 'JFK', icao: 'KJFK', name: 'John F. Kennedy International Airport', city: 'New York', country: 'United States', aliases: ['NYC', 'Queens', 'Idlewild', 'Delta Hub'], lat: 40.6413, lng: -73.7781 },
  { iata: 'EWR', icao: 'KEWR', name: 'Newark Liberty International Airport', city: 'Newark', country: 'United States', aliases: ['New York', 'NYC', 'New Jersey', 'United Hub'], lat: 40.6895, lng: -74.1745 },
  { iata: 'LGA', icao: 'KLGA', name: 'LaGuardia Airport', city: 'New York', country: 'United States', aliases: ['NYC', 'Queens'], lat: 40.7769, lng: -73.8740 },
  { iata: 'LAX', icao: 'KLAX', name: 'Los Angeles International Airport', city: 'Los Angeles', country: 'United States', aliases: ['Southern California', 'LA'], lat: 33.9416, lng: -118.4085 },
  { iata: 'SFO', icao: 'KSFO', name: 'San Francisco International Airport', city: 'San Francisco', country: 'United States', aliases: ['Bay Area', 'Silicon Valley'], lat: 37.6213, lng: -122.3790 },
  { iata: 'OAK', icao: 'KOAK', name: 'Oakland International Airport', city: 'Oakland', country: 'United States', aliases: ['Bay Area', 'San Francisco East Bay'], lat: 37.7213, lng: -122.2207 },
  { iata: 'SJC', icao: 'KSJC', name: 'Norman Y. Mineta San Jose International Airport', city: 'San Jose', country: 'United States', aliases: ['Silicon Valley', 'Bay Area'], lat: 37.3619, lng: -121.9290 },
  { iata: 'ORD', icao: 'KORD', name: "O'Hare International Airport", city: 'Chicago', country: 'United States', aliases: ['United Hub', 'American Hub', 'Illinois'], lat: 41.9742, lng: -87.9073 },
  { iata: 'MDW', icao: 'KMDW', name: 'Chicago Midway International Airport', city: 'Chicago', country: 'United States', aliases: ['Southwest Hub'], lat: 41.7868, lng: -87.7522 },
  { iata: 'ATL', icao: 'KATL', name: 'Hartsfield-Jackson Atlanta International Airport', city: 'Atlanta', country: 'United States', aliases: ['Delta World Hub', 'Georgia'], lat: 33.6407, lng: -84.4277 },
  { iata: 'DFW', icao: 'KDFW', name: 'Dallas/Fort Worth International Airport', city: 'Dallas', country: 'United States', aliases: ['Fort Worth', 'Texas', 'American Airlines Hub'], lat: 32.8998, lng: -97.0403 },
  { iata: 'DAL', icao: 'KDAL', name: 'Dallas Love Field', city: 'Dallas', country: 'United States', aliases: ['Love Field', 'Texas'], lat: 32.8471, lng: -96.8518 },
  { iata: 'DEN', icao: 'KDEN', name: 'Denver International Airport', city: 'Denver', country: 'United States', aliases: ['Colorado', 'DIA'], lat: 39.8561, lng: -104.6737 },
  { iata: 'SEA', icao: 'KSEA', name: 'Seattle-Tacoma International Airport', city: 'Seattle', country: 'United States', aliases: ['Sea-Tac', 'Washington', 'Alaska Airlines'], lat: 47.4502, lng: -122.3088 },
  { iata: 'MIA', icao: 'KMIA', name: 'Miami International Airport', city: 'Miami', country: 'United States', aliases: ['South Florida', 'Latin America Gateway'], lat: 25.7959, lng: -80.2870 },
  { iata: 'FLL', icao: 'KFLL', name: 'Fort Lauderdale-Hollywood International Airport', city: 'Fort Lauderdale', country: 'United States', aliases: ['South Florida', 'Miami Area'], lat: 26.0742, lng: -80.1506 },
  { iata: 'IAH', icao: 'KIAH', name: 'George Bush Intercontinental Airport', city: 'Houston', country: 'United States', aliases: ['Texas', 'United Hub'], lat: 29.9902, lng: -95.3368 },
  { iata: 'BOS', icao: 'KBOS', name: 'Logan International Airport', city: 'Boston', country: 'United States', aliases: ['Massachusetts', 'New England'], lat: 42.3656, lng: -71.0096 },
  { iata: 'IAD', icao: 'KIAD', name: 'Washington Dulles International Airport', city: 'Washington', country: 'United States', aliases: ['D.C.', 'Virginia', 'DMV'], lat: 38.9531, lng: -77.4565 },
  { iata: 'DCA', icao: 'KDCA', name: 'Ronald Reagan Washington National Airport', city: 'Washington', country: 'United States', aliases: ['D.C.', 'Arlington', 'National'], lat: 38.8512, lng: -77.0402 },
  { iata: 'PHX', icao: 'KPHX', name: 'Phoenix Sky Harbor International Airport', city: 'Phoenix', country: 'United States', aliases: ['Arizona'], lat: 33.4342, lng: -112.0080 },
  { iata: 'LAS', icao: 'KLAS', name: 'Harry Reid International Airport', city: 'Las Vegas', country: 'United States', aliases: ['McCarran', 'Nevada'], lat: 36.0840, lng: -115.1537 },
  { iata: 'MCO', icao: 'KMCO', name: 'Orlando International Airport', city: 'Orlando', country: 'United States', aliases: ['Florida', 'Disney World'], lat: 28.4312, lng: -81.3081 },
  { iata: 'CLT', icao: 'KCLT', name: 'Charlotte Douglas International Airport', city: 'Charlotte', country: 'United States', aliases: ['North Carolina'], lat: 35.2144, lng: -80.9473 },
  { iata: 'DTW', icao: 'KDTW', name: 'Detroit Metropolitan Wayne County Airport', city: 'Detroit', country: 'United States', aliases: ['Michigan'], lat: 42.2162, lng: -83.3554 },
  { iata: 'MSP', icao: 'KMSP', name: 'Minneapolis-Saint Paul International Airport', city: 'Minneapolis', country: 'United States', aliases: ['Twin Cities', 'Minnesota'], lat: 44.8848, lng: -93.2223 },
  { iata: 'SAN', icao: 'KSAN', name: 'San Diego International Airport', city: 'San Diego', country: 'United States', aliases: ['Lindbergh Field', 'California'], lat: 32.7338, lng: -117.1933 },
  { iata: 'TPA', icao: 'KTPA', name: 'Tampa International Airport', city: 'Tampa', country: 'United States', aliases: ['Florida'], lat: 27.9755, lng: -82.5332 },
  { iata: 'PHL', icao: 'KPHL', name: 'Philadelphia International Airport', city: 'Philadelphia', country: 'United States', aliases: ['Pennsylvania'], lat: 39.8744, lng: -75.2424 },
  { iata: 'SLC', icao: 'KSLC', name: 'Salt Lake City International Airport', city: 'Salt Lake City', country: 'United States', aliases: ['Utah'], lat: 40.7899, lng: -111.9791 },
  { iata: 'HNL', icao: 'PHNL', name: 'Daniel K. Inouye International Airport', city: 'Honolulu', country: 'United States', aliases: ['Hawaii', 'Oahu'], lat: 21.3187, lng: -157.9225 },
  { iata: 'YYZ', icao: 'CYYZ', name: 'Toronto Pearson International Airport', city: 'Toronto', country: 'Canada', aliases: ['Ontario', 'Air Canada'], lat: 43.6777, lng: -79.6248 },
  { iata: 'YVR', icao: 'CYVR', name: 'Vancouver International Airport', city: 'Vancouver', country: 'Canada', aliases: ['British Columbia', 'Richmond'], lat: 49.1947, lng: -123.1792 },
  { iata: 'YUL', icao: 'CYUL', name: 'Montreal-Trudeau International Airport', city: 'Montreal', country: 'Canada', aliases: ['Quebec', 'Dorval'], lat: 45.4706, lng: -73.7408 },
  { iata: 'YYC', icao: 'CYYC', name: 'Calgary International Airport', city: 'Calgary', country: 'Canada', aliases: ['Alberta', 'WestJet'], lat: 51.1215, lng: -114.0076 },
  { iata: 'MEX', icao: 'MMMX', name: 'Mexico City International Airport', city: 'Mexico City', country: 'Mexico', aliases: ['Benito Juarez', 'Aeromexico'], lat: 19.4363, lng: -99.0721 },
  { iata: 'CUN', icao: 'MMUN', name: 'Cancun International Airport', city: 'Cancun', country: 'Mexico', aliases: ['Riviera Maya', 'Quintana Roo'], lat: 21.0365, lng: -86.8771 },

  // South America
  { iata: 'GRU', icao: 'SBGR', name: 'Sao Paulo/Guarulhos International Airport', city: 'Sao Paulo', country: 'Brazil', aliases: ['Guarulhos', 'LATAM Brasil'], lat: -23.4356, lng: -46.4731 },
  { iata: 'GIG', icao: 'SBGL', name: 'Rio de Janeiro/Galeao International Airport', city: 'Rio de Janeiro', country: 'Brazil', aliases: ['Galeao', 'Tom Jobim'], lat: -22.8100, lng: -43.2506 },
  { iata: 'EZE', icao: 'SAEZ', name: 'Ministro Pistarini International Airport', city: 'Buenos Aires', country: 'Argentina', aliases: ['Ezeiza', 'Aerolineas Argentinas'], lat: -34.8222, lng: -58.5358 },
  { iata: 'SCL', icao: 'SCEL', name: 'Arturo Merino Benitez International Airport', city: 'Santiago', country: 'Chile', aliases: ['Pudahuel', 'LATAM Chile'], lat: -33.3930, lng: -70.7858 },
  { iata: 'BOG', icao: 'SKBO', name: 'El Dorado International Airport', city: 'Bogota', country: 'Colombia', aliases: ['Avianca'], lat: 4.7016, lng: -74.1469 },
  { iata: 'LIM', icao: 'SPJC', name: 'Jorge Chavez International Airport', city: 'Lima', country: 'Peru', aliases: ['Callao'], lat: -12.0219, lng: -77.1143 },

  // Africa
  { iata: 'JNB', icao: 'FAOR', name: 'O.R. Tambo International Airport', city: 'Johannesburg', country: 'South Africa', aliases: ['Jan Smuts', 'South African Airways'], lat: -26.1392, lng: 28.2460 },
  { iata: 'CPT', icao: 'FACT', name: 'Cape Town International Airport', city: 'Cape Town', country: 'South Africa', aliases: ['Western Cape'], lat: -33.9648, lng: 18.6017 },
  { iata: 'NBO', icao: 'HKJK', name: 'Jomo Kenyatta International Airport', city: 'Nairobi', country: 'Kenya', aliases: ['Embakasi', 'Kenya Airways'], lat: -1.3192, lng: 36.9278 },
  { iata: 'ADD', icao: 'HAAB', name: 'Addis Ababa Bole International Airport', city: 'Addis Ababa', country: 'Ethiopia', aliases: ['Bole', 'Ethiopian Airlines'], lat: 8.9779, lng: 38.7993 },
  { iata: 'LOS', icao: 'DNMM', name: 'Murtala Muhammed International Airport', city: 'Lagos', country: 'Nigeria', aliases: ['Ikeja'], lat: 6.5774, lng: 3.3212 },
  { iata: 'CMN', icao: 'GMMN', name: 'Mohammed V International Airport', city: 'Casablanca', country: 'Morocco', aliases: ['Royal Air Maroc', 'Nouasseur'], lat: 33.3675, lng: -7.5900 },
  { iata: 'ACC', icao: 'DGAA', name: 'Kotoka International Airport', city: 'Accra', country: 'Ghana', aliases: ['Ghana'], lat: 5.6052, lng: -0.1668 },

  // Oceania
  { iata: 'SYD', icao: 'YSSY', name: 'Sydney Kingsford Smith Airport', city: 'Sydney', country: 'Australia', aliases: ['Mascot', 'Qantas', 'New South Wales'], lat: -33.9399, lng: 151.1753 },
  { iata: 'MEL', icao: 'YMML', name: 'Melbourne Airport', city: 'Melbourne', country: 'Australia', aliases: ['Tullamarine', 'Victoria'], lat: -37.6690, lng: 144.8410 },
  { iata: 'BNE', icao: 'YBBN', name: 'Brisbane Airport', city: 'Brisbane', country: 'Australia', aliases: ['Queensland', 'Virgin Australia'], lat: -27.3942, lng: 153.1218 },
  { iata: 'PER', icao: 'YPPH', name: 'Perth Airport', city: 'Perth', country: 'Australia', aliases: ['Western Australia'], lat: -31.9385, lng: 115.9672 },
  { iata: 'ADL', icao: 'YPAD', name: 'Adelaide Airport', city: 'Adelaide', country: 'Australia', aliases: ['South Australia'], lat: -34.9450, lng: 138.5306 },
  { iata: 'AKL', icao: 'NZAA', name: 'Auckland Airport', city: 'Auckland', country: 'New Zealand', aliases: ['Mangere', 'Air New Zealand'], lat: -37.0082, lng: 174.7850 },
  { iata: 'CHC', icao: 'NZCH', name: 'Christchurch Airport', city: 'Christchurch', country: 'New Zealand', aliases: ['Harewood', 'South Island'], lat: -43.4894, lng: 172.5322 },
];

/**
 * Intelligent airport search function that matches IATA codes, cities, airport names, and aliases.
 * Ranks results by match quality so exact code/city matches appear at top.
 */
export function searchAirports(rawQuery: string, maxResults = 8): AirportRecord[] {
  return scoreAirports(rawQuery).slice(0, maxResults).map((s) => s.airport);
}

function scoreAirports(rawQuery: string): Array<{ airport: AirportRecord; score: number }> {
  const query = (rawQuery || '').trim().toLowerCase();
  if (!query) return [];

  const scored: Array<{ airport: AirportRecord; score: number }> = [];

  for (const airport of AIRPORT_DATABASE) {
    const iata = airport.iata.toLowerCase();
    const city = airport.city.toLowerCase();
    const name = airport.name.toLowerCase();
    const country = airport.country.toLowerCase();
    const aliases = (airport.aliases || []).map((a) => a.toLowerCase());

    let score = 0;

    // 1. Exact IATA match (highest score)
    if (iata === query) {
      score += 1000;
    } else if (iata.startsWith(query)) {
      score += 500;
    }

    // 2. City match
    if (city === query) {
      score += 800;
    } else if (city.startsWith(query)) {
      score += 400;
    } else if (city.includes(query)) {
      score += 200;
    }

    // 3. Aliases match (e.g. Bangalore -> BLR, Bombay -> BOM)
    for (const alias of aliases) {
      if (alias === query) {
        score += 750;
        break;
      } else if (alias.startsWith(query)) {
        score += 350;
        break;
      } else if (alias.includes(query)) {
        score += 150;
        break;
      }
    }

    // 4. Airport Name match
    if (name.startsWith(query)) {
      score += 300;
    } else if (name.includes(query)) {
      score += 100;
    }

    // 5. Country match
    if (country === query) {
      score += 80;
    } else if (country.startsWith(query)) {
      score += 50;
    }

    if (score > 0) {
      scored.push({ airport, score });
    }
  }

  scored.sort((a, b) => b.score - a.score);
  return scored;
}

/**
 * Airports that match free-typed text equally well (e.g. "London" -> LHR,
 * LGW, STN, LTN, LCY). Returns an empty list when the text points to a
 * single airport. Used so a multi-airport city is never silently resolved
 * to whichever airport happens to be listed first.
 */
export function findAmbiguousAirports(input?: string | null): AirportRecord[] {
  const clean = (input || '').trim();
  if (!clean || /\(([A-Za-z]{3})\)/.test(clean) || /^[A-Za-z]{3}$/.test(clean)) return [];
  const scored = scoreAirports(clean);
  if (scored.length < 2 || scored[0].score !== scored[1].score) return [];
  return scored.filter((s) => s.score === scored[0].score).map((s) => s.airport);
}

/**
 * Resolves any airport code, city name, or formatted string to its 3-letter IATA code.
 * Example inputs: "HYD", "Hyderabad", "Hyderabad (HYD)", "Bangalore" -> returns "HYD", "BLR"
 */
export function resolveToIata(input?: string | null): string | null {
  if (!input) return null;
  const clean = input.trim();

  // 1. If it contains (XXX) pattern e.g. "Hyderabad (HYD)"
  const bracketMatch = clean.match(/\(([A-Za-z]{3})\)/);
  if (bracketMatch) {
    return bracketMatch[1].toUpperCase();
  }

  // 2. If it's already a 3-letter IATA code in database
  if (/^[A-Za-z]{3}$/.test(clean)) {
    const upper = clean.toUpperCase();
    const match = AIRPORT_DATABASE.find((a) => a.iata === upper);
    if (match) return match.iata;
    return upper; // treat direct 3-letter input as potential IATA
  }

  // 3. Search database for city/alias/name match - unless several airports
  // match equally well, in which case the user has to pick one.
  if (findAmbiguousAirports(clean).length > 0) return null;
  const searchResults = searchAirports(clean, 1);
  if (searchResults.length > 0) {
    return searchResults[0].iata;
  }

  return null;
}

/**
 * Formats an airport for display in input fields (e.g. "Hyderabad (HYD)")
 */
export function formatAirportDisplay(airport: AirportRecord): string {
  return `${airport.city} (${airport.iata})`;
}
