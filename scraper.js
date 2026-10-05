const fs = require("fs");

const ENTIDADES = {
  "01": { nombre: "Aguascalientes", archivo: "vacantes-aguascalientes.json" },
  "02": { nombre: "Baja California", archivo: "vacantes-baja-california.json" },
  "03": { nombre: "Baja California Sur", archivo: "vacantes-baja-california-sur.json" },
  "04": { nombre: "Campeche", archivo: "vacantes-campeche.json" },
  "07": { nombre: "Chiapas", archivo: "vacantes-chiapas.json" },
  "08": { nombre: "Chihuahua", archivo: "vacantes-chihuahua.json" },
  "09": { nombre: "Ciudad de México", archivo: "vacantes-ciudad-de-mexico.json" },
  "05": { nombre: "Coahuila", archivo: "vacantes-coahuila.json" },
  "06": { nombre: "Colima", archivo: "vacantes-colima.json" },
  "10": { nombre: "Durango", archivo: "vacantes-durango.json" },
  "11": { nombre: "Guanajuato", archivo: "vacantes-guanajuato.json" },
  "12": { nombre: "Guerrero", archivo: "vacantes-guerrero.json" },
  "13": { nombre: "Hidalgo", archivo: "vacantes-hidalgo.json" },
  "14": { nombre: "Jalisco", archivo: "vacantes-jalisco.json" },
  "15": { nombre: "México", archivo: "vacantes-mexico.json" },
  "16": { nombre: "Michoacán", archivo: "vacantes-michoacan.json" },
  "17": { nombre: "Morelos", archivo: "vacantes-morelos.json" },
  "18": { nombre: "Nayarit", archivo: "vacantes-nayarit.json" },
  "19": { nombre: "Nuevo León", archivo: "vacantes-nuevo-leon.json" },
  "20": { nombre: "Oaxaca", archivo: "vacantes-oaxaca.json" },
  "21": { nombre: "Puebla", archivo: "vacantes-puebla.json" },
  "22": { nombre: "Querétaro", archivo: "vacantes-queretaro.json" },
  "23": { nombre: "Quintana Roo", archivo: "vacantes-quintana-roo.json" },
  "24": { nombre: "San Luis Potosí", archivo: "vacantes-san-luis-potosi.json" },
  "25": { nombre: "Sinaloa", archivo: "vacantes-sinaloa.json" },
  "26": { nombre: "Sonora", archivo: "vacantes-sonora.json" },
  "27": { nombre: "Tabasco", archivo: "vacantes-tabasco.json" },
  "28": { nombre: "Tamaulipas", archivo: "vacantes-tamaulipas.json" },
  "29": { nombre: "Tlaxcala", archivo: "vacantes-tlaxcala.json" },
  "30": { nombre: "Veracruz", archivo: "vacantes-veracruz.json" },
  "31": { nombre: "Yucatán", archivo: "vacantes-yucatan.json" },
  "32": { nombre: "Zacatecas", archivo: "vacantes-zacatecas.json" }
};

const USER_AGENTS = [
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_3) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2.1 Safari/605.1.15",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:123.0) Gecko/20100101 Firefox/123.0",
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36 Edg/122.0.0.0"
];

function obtenerHeadersHumanos() {
  const userAgent = USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
  return {
    "Content-Type": "application/json",
    "User-Agent": userAgent,
    "Accept": "application/json, text/plain, */*",
    "Accept-Language": "es-MX,es;q=0.9,en-US;q=0.8,en;q=0.7",
    "Accept-Encoding": "gzip, deflate, br",
    "Referer": "https://www.empleo.gob.mx/busqueda-ofertas-empleo",
    "Origin": "https://www.empleo.gob.mx",
    "Sec-Fetch-Dest": "empty",
    "Sec-Fetch-Mode": "cors",
    "Sec-Fetch-Site": "same-origin",
    "Sec-Ch-Ua": '"Chromium";v="122", "Not(A:Brand";v="24", "Google Chrome";v="122"',
    "Sec-Ch-Ua-Mobile": "?0",
    "Sec-Ch-Ua-Platform": '"macOS"',
    "Cache-Control": "no-cache",
    "Pragma": "no-cache"
  };
}

function pausaHumana(minMs = 1000, maxMs = 2200) {
  const tiempo = Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
  return new Promise(r => setTimeout(r, tiempo));
}

function formatearFechaTexto(fechaStr) {
  if (!fechaStr) return null;
  try {
    const fechaObj = new Date(fechaStr.length === 10 ? fechaStr + "T00:00:00" : fechaStr);
    if (isNaN(fechaObj.getTime())) return null;
    const meses = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
    return `${fechaObj.getDate()} de ${meses[fechaObj.getMonth()]} de ${fechaObj.getFullYear()}`;
  } catch(e) {
    return null;
  }
}

async function obtenerFoliosEntidad(idEntidad, tamañoPagina = 50, logCallback = console.log) {
  logCallback("🔍 Consultando folios activos en el portal oficial para la entidad ID: " + idEntidad + "...");
  let folios = [];
  let paginaActual = 1;
  let totalPaginas = 1;

  do {
    const payload = {
      que: "",
      donde: { entidad: idEntidad.toString(), ubicacion: "" },
      items: tamañoPagina,
      page: paginaActual,
      orden: "fecha_publicacion desc",
      filter: {}
    };

    try {
      const res = await fetch("https://www.empleo.gob.mx/api/Login/busqueda/empleos", {
        method: "POST",
        headers: obtenerHeadersHumanos(),
        body: JSON.stringify(payload)
      });

      if (!res.ok) throw new Error("Status " + res.status);
      const data = await res.json();

      totalPaginas = data.totalPages || 1;
      const idsPagina = (data.content || []).map(item => item.id.toString());
      folios.push(...idsPagina);

      logCallback("  📄 Página " + paginaActual + "/" + totalPaginas + " (" + idsPagina.length + " folios)");
      paginaActual++;

      await pausaHumana(600, 1200);
    } catch (err) {
      logCallback("  ❌ Error en página " + paginaActual + ": " + err.message);
      break;
    }
  } while (paginaActual <= totalPaginas);

  logCallback("✅ Total de folios vigentes en portal: " + folios.length);
  return folios;
}

async function ejecutarScraper(idEntidad = "24", maxVacantes = 0, logCallback = console.log, modoIncremental = true) {
  const infoEntidad = ENTIDADES[idEntidad] || { nombre: "Entidad " + idEntidad, archivo: "vacantes-" + idEntidad + ".json" };
  
  let vacantesExistentes = [];
  const foliosExistentesSet = new Set();

  if (fs.existsSync(infoEntidad.archivo)) {
    try {
      vacantesExistentes = JSON.parse(fs.readFileSync(infoEntidad.archivo, "utf-8"));
      vacantesExistentes.forEach(v => {
        if (v.folio) foliosExistentesSet.add(String(v.folio));
      });
      logCallback(`📂 Archivo local (${infoEntidad.nombre}): ${vacantesExistentes.length} vacantes respaldadas previamente.`);
    } catch(e) {
      logCallback(`⚠️ Error al leer archivo local ${infoEntidad.archivo}, se creará uno nuevo.`);
    }
  }

  let idsFoliosOficiales = await obtenerFoliosEntidad(idEntidad, 50, logCallback);
  let foliosAExtraer = [];

  if (modoIncremental && foliosExistentesSet.size > 0) {
    foliosAExtraer = idsFoliosOficiales.filter(id => !foliosExistentesSet.has(String(id)));
    logCallback(`⚡ MODO INCREMENTAL (${infoEntidad.nombre}): ${foliosAExtraer.length} vacantes NUEVAS (de ${idsFoliosOficiales.length} en portal).`);
  } else {
    foliosAExtraer = idsFoliosOficiales;
    logCallback(`🔄 MODO COMPLETO (${infoEntidad.nombre}): Se procesarán los ${foliosAExtraer.length} folios encontrados.`);
  }

  if (maxVacantes > 0 && foliosAExtraer.length > maxVacantes) {
    logCallback(`⚡ Limitando extracción a las primeras ${maxVacantes} vacantes pendientes.`);
    foliosAExtraer = foliosAExtraer.slice(0, maxVacantes);
  }

  if (foliosAExtraer.length === 0) {
    logCallback(`✨ ¡No hay vacantes nuevas en ${infoEntidad.nombre}! El respaldo local está al día (${vacantesExistentes.length} vacantes).`);
    return { infoEntidad, vacantes: vacantesExistentes, nuevas: [] };
  }

  const nuevasVacantesExtraidas = [];
  let procesados = 0;

  logCallback(`🚀 Extrayendo detalle de ${foliosAExtraer.length} vacantes NUEVAS (${infoEntidad.nombre})...`);

  for (const id of foliosAExtraer) {
    procesados++;
    if (procesados % 5 === 0 || procesados === foliosAExtraer.length) {
      logCallback(`  [${procesados}/${foliosAExtraer.length}] Procesando vacantes nuevas en ${infoEntidad.nombre}...`);
    }

    try {
      const respuesta = await fetch("https://www.empleo.gob.mx/api/Login/detalleOfertaEmpleo", {
        method: "POST",
        headers: obtenerHeadersHumanos(),
        body: JSON.stringify({ id: id })
      });

      if (respuesta.ok) {
        let d = await respuesta.json();
        if (d && d.datos) d = d.datos;

        if (d && d.result !== false) {
          let salarioTexto = d.salarioMensualNeto || d.salario || d.salarioOfrecido || null;
          if (salarioTexto && typeof salarioTexto === "number") {
            salarioTexto = "$" + salarioTexto.toLocaleString("es-MX");
          }
          if (!salarioTexto) salarioTexto = "No especificado";

          let salarioNum = 0;
          if (salarioTexto && salarioTexto !== "No especificado") {
            const matches = salarioTexto.replace(/,/g, "").match(/\d+(\.\d+)?/g);
            if (matches && matches.length > 0) {
              salarioNum = parseFloat(matches[0]);
            }
          }

          let empresaNombre = d.empleador || d.empresa || d.nombreComercial || "Confidencial";
          if (typeof empresaNombre === "string") empresaNombre = empresaNombre.trim();

          let ubicacionStr = d.ubicacion || null;
          let municipioStr = d.municipio || "No especificado";
          let estadoStr = d.estado || infoEntidad.nombre;

          if (ubicacionStr) {
            const partesUbicacion = ubicacionStr.split(",");
            if (partesUbicacion.length >= 2) {
              municipioStr = partesUbicacion[0].trim();
              estadoStr = partesUbicacion[1].trim();
            } else {
              municipioStr = ubicacionStr.trim();
            }
          } else {
            ubicacionStr = `${municipioStr}, ${estadoStr}`;
          }

          let descripcionText = d.descripcion || d.detalles || d.resumen || "Sin descripción proporcionada.";

          let logoUrl = null;
          if (d.empleador_logo || d.logo) {
            const logoRaw = d.empleador_logo || d.logo;
            logoUrl = logoRaw.startsWith("http") 
              ? logoRaw 
              : `https://www.empleo.gob.mx/assets/img/bt/${logoRaw.replace(/^\/?(assets\/img\/bt\/)?/, "")}`;
          }

          const rawFechaFin = d.fechaFinal || d.fechaFin;
          const fechaVigenciaIso = rawFechaFin ? new Date(rawFechaFin).toISOString() : null;
          const fechaFormateada = formatearFechaTexto(rawFechaFin);
          const vigenciaTexto = fechaFormateada ? `Vigente hasta el ${fechaFormateada}` : "No especificado";

          let listaReclutamiento = [];
          if (Array.isArray(d.desDuracionProcesoReclutamiento) && d.desDuracionProcesoReclutamiento.length > 0) {
            listaReclutamiento.push(...d.desDuracionProcesoReclutamiento);
          }
          if (Array.isArray(d.pasosRecluta) && d.pasosRecluta.length > 0) {
            listaReclutamiento.push(...d.pasosRecluta);
          }
          if (listaReclutamiento.length === 0) {
            listaReclutamiento.push("Proceso estándar de reclutamiento de la empresa");
          }

          const urlVacante = `https://www.empleo.gob.mx/puesto-de-trabajo/vacante/${id}`;

          nuevasVacantesExtraidas.push({
            folio: id,
            puesto: d.puesto || d.tituloOferta || "No especificado",
            empresa: empresaNombre,
            empresa_logo: logoUrl,
            salario_mensual_neto: salarioTexto,
            salario_numerico: salarioNum,
            ubicacion: ubicacionStr,
            estado: estadoStr,
            municipio: municipioStr,
            descripcion: descripcionText,
            requisitos: Array.isArray(d.requisitos) ? d.requisitos : [],
            horario: Array.isArray(d.horario) ? d.horario : [],
            funciones_actividades: Array.isArray(d.funcionesActividades) ? d.funcionesActividades : [],
            prestaciones: Array.isArray(d.listaBeneficios) ? d.listaBeneficios : [],
            tipo_contratacion: d.tipoContratacion || "No especificado",
            proceso_reclutamiento: listaReclutamiento,
            fecha_publicacion: d.fechaInicia ? new Date(d.fechaInicia).toISOString() : new Date().toISOString(),
            fecha_vigencia: fechaVigenciaIso,
            vigencia_texto: vigenciaTexto,
            url_vacante: urlVacante
          });
        }
      }
      
      await pausaHumana(1000, 2000);

      if (procesados % 20 === 0) {
        logCallback("  ☕ Micro-pausa de navegación humana (3 segundos)...");
        await pausaHumana(3000, 4500);
      }

    } catch (error) {
      logCallback("  ❌ Error vacante folio " + id + ": " + error.message);
    }
  }

  const baseDatosActualizada = [...nuevasVacantesExtraidas, ...vacantesExistentes];
  fs.writeFileSync(infoEntidad.archivo, JSON.stringify(baseDatosActualizada, null, 2));

  logCallback(`🎉 Extracción incremental (${infoEntidad.nombre}) finalizada: ${nuevasVacantesExtraidas.length} vacantes nuevas agregadas. Total en archivo local: ${baseDatosActualizada.length}.`);
  return { infoEntidad, vacantes: baseDatosActualizada, nuevas: nuevasVacantesExtraidas };
}

/**
 * Escanea y sincroniza de forma incremental las 32 Entidades Federativas
 */
async function ejecutarScraperNacional(syncSupabaseCallback, logCallback = console.log) {
  logCallback("🇲🇽 INICIANDO ESCANEO INCREMENTAL NACIONAL (32 ESTADOS)...");
  
  const listaIds = Object.keys(ENTIDADES).sort((a, b) => a.localeCompare(b));
  let totalNuevasNacionales = 0;
  let estadosConNovedades = 0;

  for (let i = 0; i < listaIds.length; i++) {
    const idEntidad = listaIds[i];
    const info = ENTIDADES[idEntidad];

    logCallback(`\n==================================================`);
    logCallback(`📍 [${i + 1}/${listaIds.length}] Procesando ${info.nombre} (ID: ${idEntidad})...`);
    logCallback(`==================================================`);

    try {
      const resultado = await ejecutarScraper(idEntidad, 0, logCallback, true);
      
      if (resultado.nuevas && resultado.nuevas.length > 0) {
        totalNuevasNacionales += resultado.nuevas.length;
        estadosConNovedades++;
        logCallback(`📤 Sincronizando ${resultado.nuevas.length} vacantes nuevas de ${info.nombre} a Supabase...`);
        
        if (syncSupabaseCallback) {
          await syncSupabaseCallback(resultado.nuevas, logCallback);
        }
      } else {
        logCallback(`✨ ${info.nombre} ya estaba 100% al día.`);
      }

      await pausaHumana(1500, 3000);
    } catch (err) {
      logCallback(`❌ Error en estado ${info.nombre}: ${err.message}`);
    }
  }

  logCallback(`\n==================================================`);
  logCallback(`🎉 ESCANEO NACIONAL COMPLETADO`);
  logCallback(`📊 Vacantes nuevas totales sincronizadas: ${totalNuevasNacionales}`);
  logCallback(`🗺️ Estados con vacantes nuevas: ${estadosConNovedades} de 32`);
  logCallback(`==================================================`);

  return { totalNuevasNacionales, estadosConNovedades };
}

module.exports = { ejecutarScraper, ejecutarScraperNacional, ENTIDADES };
