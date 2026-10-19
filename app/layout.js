import './globals.css';

export const metadata = {
  title: '¿Quién Es? — Live Stream Show',
  description: 'Juego interactivo en tiempo real para streaming con código QR',
};

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body className="antialiased selection:bg-indigo-500 selection:text-white">
        {children}
      </body>
    </html>
  );
}
