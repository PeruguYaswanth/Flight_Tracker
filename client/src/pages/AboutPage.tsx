import React from 'react';
import { Plane, Database, Radio, Mail } from 'lucide-react';
import { Layout } from '../components/Layout';

export const AboutPage: React.FC = () => {
  return (
    <Layout>
      <div className="max-w-3xl w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-8">
        <div className="text-center space-y-2">
          <div className="w-14 h-14 rounded-2xl bg-cyan-950 border border-cyan-800 flex items-center justify-center text-cyan-400 mx-auto">
            <Plane className="w-7 h-7 -rotate-45" />
          </div>
          <h1 className="text-2xl font-bold text-white">About AeroTrack</h1>
          <p className="text-sm text-slate-400 max-w-xl mx-auto">
            AeroTrack is a flight-status tracking tool for looking up real-time flight information by flight number
            or by departure/arrival route.
          </p>
        </div>

        <section className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3">
          <h2 className="text-sm font-semibold text-white flex items-center gap-2">
            <Radio className="w-4 h-4 text-cyan-400" />
            What AeroTrack does
          </h2>
          <p className="text-sm text-slate-400 leading-relaxed">
            Search for a flight by its flight number, or find flights between two airports. AeroTrack shows
            scheduled, estimated, and actual departure/arrival times, gate and terminal information, flight status,
            and - when the data provider makes it available - the aircraft's live position on the map.
          </p>
        </section>

        <section className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3">
          <h2 className="text-sm font-semibold text-white flex items-center gap-2">
            <Database className="w-4 h-4 text-cyan-400" />
            Supported information
          </h2>
          <ul className="text-sm text-slate-400 space-y-1.5 list-disc list-inside">
            <li>Flight number, airline, and flight status</li>
            <li>Origin and destination airports, terminal, and gate</li>
            <li>Scheduled, estimated, and actual departure/arrival times</li>
            <li>Departure and arrival delays</li>
            <li>Live aircraft position, altitude, speed, and heading, when reported by the provider</li>
            <li>Airport departures and arrivals lookup</li>
          </ul>
        </section>

        <section className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-2">
          <h2 className="text-sm font-semibold text-white">Data disclaimer</h2>
          <p className="text-xs text-slate-400 leading-relaxed">
            Flight data is provided by a third-party aviation data provider (Aviationstack). Not all fields are
            available for every flight - live position, gate, and delay information depend on what the airline and
            airport report to the provider. AeroTrack never fabricates flight data: fields that are not reported are
            shown as unavailable rather than estimated.
          </p>
        </section>

        <section className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-2">
          <h2 className="text-sm font-semibold text-white flex items-center gap-2">
            <Mail className="w-4 h-4 text-cyan-400" />
            Contact
          </h2>
          <p className="text-xs text-slate-400">
            Questions or feedback about AeroTrack? Reach out to <span className="text-slate-300">support@aerotrack.example</span>.
          </p>
        </section>
      </div>
    </Layout>
  );
};
