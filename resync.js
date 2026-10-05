require("dotenv").config();
const fs = require("fs");
const path = require("path");
const { createClient } = require("@supabase/supabase-js");
const { syncJobsToAyjaleSupabase } = require("./ayjaleAdapter.js");

async function reSincronizarArchivo(nombreArchivo) {
  if (!fs.existsSync(nombreArchivo)) {
    console.error("❌ El archivo no existe:", nombreArchivo);
    return;
  }

  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
  const rawData = JSON.parse(fs.readFileSync(nombreArchivo, "utf-8"));

  console.log(`
==================================================`);
  console.log(`🔄 Re-sincronizando ${rawData.length} vacantes de ${nombreArchivo} en Supabase...`);
  console.log(`==================================================`);

  await syncJobsToAyjaleSupabase(supabase, rawData, console.log);
}

const archivoAProcesar = process.argv[2] || "vacantes-nuevo-leon.json";
reSincronizarArchivo(archivoAProcesar);
