import './globals.css';
import { Barlow_Condensed, Plus_Jakarta_Sans } from 'next/font/google';

const barlowCondensed = Barlow_Condensed({
  subsets: ['latin'],
  weight: ['600', '700', '800', '900'],
  variable: '--font-barlow',
});

const jakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['500', '600', '700', '800'],
  variable: '--font-jakarta',
});

export const metadata = {
  title: '¿Quién Es? — Hogar de Cristo Stream Show',
  description: 'Juego televisivo interactivo en tiempo real con código QR',
};

export default function RootLayout({ children }) {
  return (
    <html lang="es" className={`${barlowCondensed.variable} ${jakarta.variable}`}>
      <body className="antialiased selection:bg-[#008899] selection:text-white">
        {children}
      </body>
    </html>
  );
}
