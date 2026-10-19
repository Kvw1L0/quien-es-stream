import Link from 'next/link';
import { Tv, Smartphone, Sliders } from 'lucide-react';

export default function HomePage() {
  return (
    <main
      className="min-h-screen flex flex-col items-center justify-center p-6 bg-cover bg-center"
      style={{ backgroundImage: "url('/key-visual-bg.jpg')" }}
    >
      <div className="max-w-4xl w-full text-center mb-16">
        <span className="inline-block px-5 py-1.5 rounded-full bg-[#008296] text-white font-extrabold text-xs uppercase tracking-widest mb-4 shadow">
          HOGAR DE CRISTO • LIVE STREAM SHOW
        </span>
        <h1 className="font-display text-6xl md:text-7xl font-black text-[#005566] uppercase tracking-wide mb-10 drop-shadow-sm">
          ¿QUIÉN ES EL PERSONAJE?
        </h1>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Link
            href="/tv"
            className="group p-7 rounded-3xl bg-white/95 backdrop-blur-md border-4 border-[#008296] hover:scale-[1.03] transition flex flex-col items-center text-center shadow-[0_15px_40px_rgba(0,85,102,0.18)]"
          >
            <div className="w-16 h-16 rounded-2xl bg-[#008296] flex items-center justify-center mb-4 group-hover:scale-110 transition shadow-md">
              <Tv className="w-8 h-8 text-white" />
            </div>
            <h2 className="font-display text-3xl font-black text-[#005566] uppercase mb-1">
              Pantalla TV / OBS
            </h2>
            <p className="text-xs text-[#005566]/80 font-bold">
              Vista televisiva oficial con el Key Visual para el streaming.
            </p>
          </Link>

          <Link
            href="/play"
            className="group p-7 rounded-3xl bg-white/95 backdrop-blur-md border-4 border-[#e5a93c] hover:scale-[1.03] transition flex flex-col items-center text-center shadow-[0_15px_40px_rgba(0,85,102,0.18)]"
          >
            <div className="w-16 h-16 rounded-2xl bg-[#e5a93c] flex items-center justify-center mb-4 group-hover:scale-110 transition shadow-md">
              <Smartphone className="w-8 h-8 text-[#003d4a]" />
            </div>
            <h2 className="font-display text-3xl font-black text-[#005566] uppercase mb-1">
              Pantalla Jugador
            </h2>
            <p className="text-xs text-[#005566]/80 font-bold">
              Vista móvil para quienes escanean el código QR en vivo.
            </p>
          </Link>

          <Link
            href="/admin"
            className="group p-7 rounded-3xl bg-white/95 backdrop-blur-md border-4 border-[#84bd00] hover:scale-[1.03] transition flex flex-col items-center text-center shadow-[0_15px_40px_rgba(0,85,102,0.18)]"
          >
            <div className="w-16 h-16 rounded-2xl bg-[#84bd00] flex items-center justify-center mb-4 group-hover:scale-110 transition shadow-md">
              <Sliders className="w-8 h-8 text-white" />
            </div>
            <h2 className="font-display text-3xl font-black text-[#005566] uppercase mb-1">
              Panel Director
            </h2>
            <p className="text-xs text-[#005566]/80 font-bold">
              Carga fotos en lote, revela manualmente la respuesta y controla el show.
            </p>
          </Link>
        </div>
      </div>
    </main>
  );
}
