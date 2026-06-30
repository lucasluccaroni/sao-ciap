import type { NextConfig } from "next";
import dotenv from "dotenv";

// TODO: Reemplaza esta ruta con la ruta absoluta real donde guardaste tu .env.local
// Ejemplo en Windows: "D:\\secrets\\sao-ciap\\.env.local"
dotenv.config({ path: "D:\\secrets\\sao-ciap\\.env.local" });

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
