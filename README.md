# ¿Quién Es? — Interactive Live Stream Trivia Show

Aplicación web interactiva para shows en streaming con 3 pantallas sincronizadas en tiempo real:

- **`/tv` (Pantalla Principal / OBS):** Vista limpia sin textos innecesarios para proyectar en TV o insertar como *Browser Source* en OBS (soporta Fondo Estudio Oscuro, Transparente y Chroma Verde).
- **`/play` (Pantalla Jugador - QR Móvil):** Los espectadores escanean el QR en pantalla, eligen su apodo, ven la cara distorsionándose en tiempo real en su celular y compiten respondiendo entre 4 opciones (más puntos por velocidad y racha).
- **`/admin` (Panel de Director):** Carga de fotos por lote (Drag & Drop), generación automática de distractores usando los nombres del lote, miniaturas con estado, control de efectos (*Remolino + Blur, Pixelado, Difuminado, Zoom*), congelar timer, revelar foto y mostrar ranking.

## Despliegue en Vercel

1. Importa este repositorio en [Vercel](https://vercel.com/new).
2. Haz clic en **Deploy** (funciona de inmediato).
3. *(Opcional para alta concurrencia serverless)*: En el panel de tu proyecto en Vercel, ve a **Storage** -> **Create Database** -> **Upstash Redis (Serverless KV)** y conéctalo en 1 clic. La app detectará automáticamente las variables `KV_REST_API_URL` / `UPSTASH_REDIS_REST_URL`.
