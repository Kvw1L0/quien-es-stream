import Link from 'next/link';
import { Tv, Smartphone, Sliders } from 'lucide-react';

export default function HomePage() {
  return (
    <main className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-6">
      <div className="max-w-3xl w-full text-center">
        <span className="inline-block px-4 py-1.5 rounded-full bg-indigo-500/20 border border-indigo-400/30 text-indigo-300 font-black text-xs uppercase tracking-widest mb-4">
          LIVE STREAMING SHOW
        </span>
        <h1 className="text-5xl md:text-6xl font-black tracking-tight mb-10">
          ¿QUIÉN ES?
        </h1>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <Link
            href="/tv"
            className="group p-7 rounded-3xl bg-slate-900 border-2 border-indigo-500/40 hover:border-indigo-400 transition flex flex-col items-center text-center shadow-xl"
          >
            <div className="w-14 h-14 rounded-2xl bg-indigo-600/25 flex items-center justify-center mb-4 group-hover:scale-110 transition">
              <Tv className="w-7 h-7 text-indigo-400" />
            </div>
            <h2 className="text-xl font-black mb-1">Pantalla TV / OBS</h2>
            <p className="text-xs text-slate-400">
              Vista ultra limpia para proyectar en el show o fuente de OBS.
            </p>
          </Link>

          <Link
            href="/play"
            className="group p-7 rounded-3xl bg-slate-900 border-2 border-fuchsia-500/40 hover:border-fuchsia-400 transition flex flex-col items-center text-center shadow-xl"
          >
            <div className="w-14 h-14 rounded-2xl bg-fuchsia-600/25 flex items-center justify-center mb-4 group-hover:scale-110 transition">
              <Smartphone className="w-7 h-7 text-fuchsia-400" />
            </div>
            <h2 className="text-xl font-black mb-1">Pantalla Jugador</h2>
            <p className="text-xs text-slate-400">
              Vista móvil a la que entran los espectadores con el código QR.
            </p>
          </Link>

          <Link
            href="/admin"
            className="group p-7 rounded-3xl bg-slate-900 border-2 border-emerald-500/40 hover:border-emerald-400 transition flex flex-col items-center text-center shadow-xl"
          >
            <div className="w-14 h-14 rounded-2xl bg-emerald-600/25 flex items-center justify-center mb-4 group-hover:scale-110 transition">
              <Sliders className="w-7 h-7 text-emerald-400" />
            </div>
            <h2 className="text-xl font-black mb-1">Panel Director</h2>
            <p className="text-xs text-slate-400">
              Carga fotos en lote, controla el timer, efectos y ranking.
            </p>
          </Link>
        </div>
      </div>
    </main>
  );
}
