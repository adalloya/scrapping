require("dotenv").config();
const express = require("express");
const fs = require("fs");
const path = require("path");
const cron = require("node-cron");
const { createClient } = require("@supabase/supabase-js");
const { ejecutarScraper, ejecutarScraperNacional, ENTIDADES } = require("./scraper");
const { syncJobsToAyjaleSupabase, transformScrapedJobToAyjale } = require("./ayjaleAdapter");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

let supabase = null;
if (process.env.SUPABASE_URL && process.env.SUPABASE_URL !== "YOUR_SUPABASE_URL_HERE") {
  supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
}

let estadoProgreso = {
  enEjecucion: false,
  modo: "individual", // "individual", "nacional" o "programado"
  logs: [],
  ultimaEntidad: null,
  totalVacantesGuardadas: 0,
  vacantesNuevas: 0,
  proximaEjecucionProgramada: "5:00 AM, 10:00 AM, 1:00 PM, 6:00 PM, 11:00 PM"
};

function agregarLog(mensaje) {
  const timestamp = new Date().toLocaleTimeString();
  const logEntrada = `[${timestamp}] ${mensaje}`;
  estadoProgreso.logs.push(logEntrada);
  if (estadoProgreso.logs.length > 250) estadoProgreso.logs.shift();
  console.log(logEntrada);
}

function limpiarTextoCSV(str) {
  if (!str) return "";
  if (Array.isArray(str)) str = str.join("; ");
  let limpio = String(str).replace(/"/g, '""').replace(/\r?\n|\r/g, " ");
  return `"${limpio}"`;
}

// ----------------------------------------------------
// CRON PROGRAMADO: 5:00 AM, 10:00 AM, 1:00 PM, 6:00 PM, 11:00 PM
// Expresión Cron: '0 5,10,13,18,23 * * *'
// ----------------------------------------------------
const CRON_HORARIOS = "0 5,10,13,18,23 * * *";

cron.schedule(CRON_HORARIOS, async () => {
  if (estadoProgreso.enEjecucion) {
    agregarLog("⏰ [CRON] Se omitió la ejecución programada porque ya hay un proceso activo.");
    return;
  }

  agregarLog("\n⏰ [CRON PROGRAMADO] Iniciando Sincronización Nacional Incremental Automática...");
  estadoProgreso.enEjecucion = true;
  estadoProgreso.modo = "programado";

  try {
    const syncCallback = async (nuevasVacantes, logCb) => {
      if (supabase && nuevasVacantes && nuevasVacantes.length > 0) {
        await syncJobsToAyjaleSupabase(supabase, nuevasVacantes, logCb);
      }
    };

    const resumen = await ejecutarScraperNacional(syncCallback, agregarLog);
    estadoProgreso.vacantesNuevas = resumen.totalNuevasNacionales;
    agregarLog(`🎉 [CRON PROGRAMADO] Proceso automático finalizado. ${resumen.totalNuevasNacionales} vacantes nuevas sincronizadas.`);
  } catch (err) {
    agregarLog(`❌ [CRON PROGRAMADO] Error en escaneo automático: ${err.message}`);
  } finally {
    estadoProgreso.enEjecucion = false;
  }
});

console.log("⏰ Tarea programada (Cron) activa: Sincronización nacional a las 5:00 AM, 10:00 AM, 1:00 PM, 6:00 PM y 11:00 PM.");

// Routes
app.get("/api/config", (req, res) => {
  res.json({
    supabaseConfigurado: !!supabase,
    entidades: ENTIDADES,
    horariosProgramados: ["05:00", "10:00", "13:00", "18:00", "23:00"]
  });
});

app.get("/api/status", (req, res) => {
  res.json(estadoProgreso);
});

app.post("/api/scrape", async (req, res) => {
  if (estadoProgreso.enEjecucion) {
    return res.status(400).json({ error: "Ya hay un proceso de scraping en ejecución." });
  }

  const { idEntidad = "24", maxVacantes = 0, modoIncremental = true } = req.body;
  
  estadoProgreso.enEjecucion = true;
  estadoProgreso.modo = "individual";
  estadoProgreso.logs = [];
  estadoProgreso.ultimaEntidad = idEntidad;

  res.json({ status: "Proceso iniciado", idEntidad, modoIncremental });

  try {
    const resultado = await ejecutarScraper(idEntidad, maxVacantes, agregarLog, modoIncremental);
    
    estadoProgreso.totalVacantesGuardadas = resultado.vacantes.length;
    estadoProgreso.vacantesNuevas = resultado.nuevas ? resultado.nuevas.length : 0;

    if (supabase) {
      if (resultado.nuevas && resultado.nuevas.length > 0) {
        agregarLog(`📤 Subiendo solo las ${resultado.nuevas.length} vacantes NUEVAS a Ayjale.com (tabla jobs)...`);
        await syncJobsToAyjaleSupabase(supabase, resultado.nuevas, agregarLog);
      } else {
        agregarLog(`ℹ No hubo vacantes nuevas por subir. Tu base de datos y archivo local están al día.`);
      }
    } else {
      agregarLog("ℹ Supabase no está configurado aún en .env. Se guardaron los archivos JSON locales.");
    }
  } catch (err) {
    agregarLog(`❌ Error general en scraping: ${err.message}`);
  } finally {
    estadoProgreso.enEjecucion = false;
  }
});

app.post("/api/scrape-nacional", async (req, res) => {
  if (estadoProgreso.enEjecucion) {
    return res.status(400).json({ error: "Ya hay un proceso de scraping en ejecución." });
  }

  estadoProgreso.enEjecucion = true;
  estadoProgreso.modo = "nacional";
  estadoProgreso.logs = [];

  res.json({ status: "Escaneo nacional incremental iniciado" });

  try {
    const syncCallback = async (nuevasVacantes, logCb) => {
      if (supabase && nuevasVacantes && nuevasVacantes.length > 0) {
        await syncJobsToAyjaleSupabase(supabase, nuevasVacantes, logCb);
      }
    };

    const resumen = await ejecutarScraperNacional(syncCallback, agregarLog);
    estadoProgreso.vacantesNuevas = resumen.totalNuevasNacionales;
  } catch (err) {
    agregarLog(`❌ Error en escaneo nacional: ${err.message}`);
  } finally {
    estadoProgreso.enEjecucion = false;
  }
});

app.get("/api/vacantes-locales", (req, res) => {
  const { idEntidad = "24" } = req.query;
  const info = ENTIDADES[idEntidad] || { archivo: `vacantes-${idEntidad}.json` };
  if (fs.existsSync(info.archivo)) {
    const content = fs.readFileSync(info.archivo, "utf-8");
    const rawJobs = JSON.parse(content);
    const transformedJobs = rawJobs.map(transformScrapedJobToAyjale);
    res.json({ raw: rawJobs, ayjaleJobs: transformedJobs });
  } else {
    res.json({ raw: [], ayjaleJobs: [] });
  }
});

app.get("/api/exportar-excel", (req, res) => {
  try {
    const archivos = fs.readdirSync(__dirname).filter(f => f.startsWith("vacantes-") && f.endsWith(".json"));
    
    let vacantesConsolidadas = [];
    const foliosVistos = new Set();

    for (const archivo of archivos) {
      try {
        const contenido = JSON.parse(fs.readFileSync(path.join(__dirname, archivo), "utf-8"));
        if (Array.isArray(contenido)) {
          contenido.forEach(v => {
            if (v.folio && !foliosVistos.has(String(v.folio))) {
              foliosVistos.add(String(v.folio));
              vacantesConsolidadas.push(v);
            }
          });
        }
      } catch (e) {}
    }

    if (vacantesConsolidadas.length === 0) {
      return res.status(404).send("No hay vacantes respaldadas localmente para exportar.");
    }

    const headers = [
      "Folio",
      "Puesto / Vacante",
      "Empresa",
      "Salario Neto",
      "Salario Numerico",
      "Ubicacion",
      "Municipio",
      "Estado",
      "Tipo Contratacion",
      "Descripcion",
      "Requisitos",
      "Horario",
      "Funciones y Actividades",
      "Prestaciones",
      "Proceso Reclutamiento",
      "Vigencia Texto",
      "URL Vacante",
      "Logo Empresa",
      "Fecha Publicacion"
    ];

    const filas = [];
    filas.push(headers.join(","));

    for (const v of vacantesConsolidadas) {
      const fila = [
        limpiarTextoCSV(v.folio),
        limpiarTextoCSV(v.puesto),
        limpiarTextoCSV(v.empresa),
        limpiarTextoCSV(v.salario_mensual_neto),
        limpiarTextoCSV(v.salario_numerico),
        limpiarTextoCSV(v.ubicacion),
        limpiarTextoCSV(v.municipio),
        limpiarTextoCSV(v.estado),
        limpiarTextoCSV(v.tipo_contratacion),
        limpiarTextoCSV(v.descripcion),
        limpiarTextoCSV(v.requisitos),
        limpiarTextoCSV(v.horario),
        limpiarTextoCSV(v.funciones_actividades),
        limpiarTextoCSV(v.prestaciones),
        limpiarTextoCSV(v.proceso_reclutamiento),
        limpiarTextoCSV(v.vigencia_texto),
        limpiarTextoCSV(v.url_vacante),
        limpiarTextoCSV(v.empresa_logo),
        limpiarTextoCSV(v.fecha_publicacion)
      ];
      filas.push(fila.join(","));
    }

    const csvContent = "\uFEFF" + filas.join("\n");
    const fechaHoy = new Date().toISOString().slice(0, 10);
    const nombreArchivo = `Vacantes_Nacionales_Ayjale_${fechaHoy}.csv`;

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${nombreArchivo}"`);
    res.send(csvContent);

  } catch (err) {
    res.status(500).send("Error al generar el archivo de Excel: " + err.message);
  }
});

app.listen(PORT, () => {
  console.log(`\n🚀 Panel del Scraper Ayjale ejecutándose en http://localhost:${PORT}`);
});
