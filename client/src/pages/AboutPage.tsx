import React from 'react';
import { Plane, Database, Radio, Mail, ShieldCheck } from 'lucide-react';
import { Layout } from '../components/Layout';

export const AboutPage: React.FC = () => {
  return (
    <Layout>
      <div className="max-w-3xl w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-8">
        {/* Header Hero */}
        <div className="text-center space-y-3">
          <div className="w-14 h-14 rounded-2xl bg-sky-50 border border-sky-100 flex items-center justify-center text-sky-600 mx-auto shadow-2xs">
            <Plane className="w-7 h-7 -rotate-45" />
          </div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">About Flight Tracker</h1>
          <p className="text-sm text-slate-600 max-w-xl mx-auto leading-relaxed">
            A professional flight status and radar tracking application designed for real-time commercial aviation visibility, route lookup, and ADS-B telemetry.
          </p>
        </div>

        {/* Feature Cards */}
        <div className="space-y-4">
          <section className="bg-white border border-slate-200/90 rounded-2xl p-6 space-y-2 shadow-2xs">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Radio className="w-4 h-4 text-sky-600" />
              Core Functionality
            </h2>
            <p className="text-sm text-slate-600 leading-relaxed">
              Search by commercial flight number (e.g. 6E6372, AI101) or by route typing common city names and airport codes. The application resolves natural language input into verified IATA codes to fetch scheduled, estimated, and actual departure/arrival times, gate/terminal info, and live radar tracking.
            </p>
          </section>

          <section className="bg-white border border-slate-200/90 rounded-2xl p-6 space-y-3 shadow-2xs">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Database className="w-4 h-4 text-sky-600" />
              Supported Flight Data
            </h2>
            <ul className="text-sm text-slate-600 space-y-2 list-disc list-inside">
              <li>Flight number, operating carrier (codeshares), airline brand, and flight status</li>
              <li>Origin and destination airport name, city, IATA/ICAO code, terminal, and gate</li>
              <li>Scheduled, estimated, and actual takeoff / touchdown times</li>
              <li>Departure and arrival delay metrics</li>
              <li>Real-time ADS-B transponder telemetry: speed, altitude, heading, and live coordinates</li>
              <li>Airport departures and arrivals directory</li>
            </ul>
          </section>

          <section className="bg-white border border-slate-200/90 rounded-2xl p-6 space-y-2 shadow-2xs">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              Data Integrity Guarantee
            </h2>
            <p className="text-xs text-slate-500 leading-relaxed">
              Flight data and live positions are sourced from verified aviation providers. Missing fields are explicitly marked as "Not available" rather than fabricated. Live aircraft markers appear strictly when genuine ADS-B coordinates are broadcast by the aircraft transponder.
            </p>
          </section>

          <section className="bg-white border border-slate-200/90 rounded-2xl p-6 space-y-2 shadow-2xs">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Mail className="w-4 h-4 text-sky-600" />
              Support & Inquiries
            </h2>
            <p className="text-xs text-slate-600">
              Questions or feedback regarding Flight Tracker PRO? Contact the development team at <span className="font-semibold text-sky-700">support@flighttracker.app</span>.
            </p>
          </section>
        </div>
      </div>
    </Layout>
  );
};
