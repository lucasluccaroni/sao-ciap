import type { NextConfig } from "next";
import dotenv from "dotenv";

import fs from "fs";

// Cargar variables de entorno desde la carpeta externa de secretos principal o fallback local
const externalEnvPath = "D:\\secrets\\sao-ciap\\.env.local";
if (fs.existsSync(externalEnvPath)) {
  dotenv.config({ path: externalEnvPath });
} else {
  dotenv.config();
}

const nextConfig: NextConfig = {
  /* config options here */
  env: {
    // Para que Next.js compile correctamente las variables de entorno de cliente
    // (las que empiezan con NEXT_PUBLIC_), debemos inyectarlas explícitamente
    // si las estamos cargando manualmente con dotenv desde otra ruta.
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  },
};


export default nextConfig;
