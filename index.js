const fs = require("fs");

// Mapeo de entidades federativas del Portal del Empleo
const ENTIDADES = {
  "19": { nombre: "Nuevo León", archivo: "vacantes-nl.json" },
  "24": { nombre: "San Luis Potosí", archivo: "vacantes-slp.json" }
};

const HEADERS = {
  "Content-Type": "application/json",
  "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Accept": "application/json, text/plain, */*",
  "Referer": "https://www.empleo.gob.mx/"
};

// 1. Obtener la lista dinámica de folios por entidad
async function obtenerFoliosEntidad(idEntidad, tamañoPagina = 50) {
  console.log(`🔍 Obteniendo catálogo de vacantes activas para la entidad ID: ${idEntidad}...`);
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
        headers: HEADERS,
        body: JSON.stringify(payload)
      });

      if (!res.ok) throw new Error(`Status ${res.status}`);
      const data = await res.json();

      totalPaginas = data.totalPages || 1;
      const idsPagina = (data.content || []).map(item => item.id.toString());
      folios.push(...idsPagina);

      console.log(`  📄 Página ${paginaActual}/${totalPaginas} procesada (${idsPagina.length} folios encontrados)`);
      paginaActual++;

      await new Promise(r => setTimeout(r, 500));
    } catch (err) {
      console.error(`  ❌ Error al consultar la página ${paginaActual}:`, err.message);
      break;
    }
  } while (paginaActual <= totalPaginas);

  console.log(`✅ Total de folios recuperados para la entidad ${idEntidad}: ${folios.length}
`);
  return folios;
}

// 2. Extraer el detalle completo de cada folio
async function extraerDetallesVacantes(idEntidad = "24") {
  const infoEntidad = ENTIDADES[idEntidad] || { nombre: "Entidad " + idEntidad, archivo: `vacantes-${idEntidad}.json` };
  const idsFolios = await obtenerFoliosEntidad(idEntidad);
  
  const baseDatos = [];
  let procesados = 0;

  console.log(`🚀 Iniciando extracción detallada de ${idsFolios.length} vacantes en ${infoEntidad.nombre}...`);

  for (const id of idsFolios) {
    procesados++;
    console.log(`[${procesados}/${idsFolios.length}] Consultando detalle del folio: ${id}...`);

    try {
      const respuesta = await fetch("https://www.empleo.gob.mx/api/Login/detalleOfertaEmpleoElasticSearch", {
        method: "POST",
        headers: HEADERS,
        body: JSON.stringify({ id: id, treemapita: false })
      });

      if (!respuesta.ok) throw new Error(`Status ${respuesta.status}`);

      const detalle = await respuesta.json();

      if (detalle && detalle.result !== false) {
        baseDatos.push({
          folio: id,
          puesto: detalle.puesto || detalle.tituloOferta || "No especificado",
          empresa: detalle.nombreComercial || detalle.empresa || "No especificado",
          salarioMensualNeto: detalle.salarioMensualNeto || detalle.salarioOfrecido,
          ubicacion: {
            estado: detalle.estado || infoEntidad.nombre,
            municipio: detalle.municipio || "No especificado"
          },
          requisitos: detalle.requisitos || detalle.experienciaRequerida || "No especificado",
          funciones: detalle.funciones || "No especificado",
          horario: detalle.horario || "No especificado",
          tipoContrato: detalle.tipoContrato || "No especificado",
          fechaPublicacion: detalle.fechaInicioVigencia || detalle.fechaPublicacion
        });
      }

      // Pausa respetuosa para no saturar el servidor del gobierno
      await new Promise(r => setTimeout(r, 1200));
    } catch (error) {
      console.log(`  ❌ Error al extraer folio ${id}:`, error.message);
    }
  }

  // Guardar datos extraídos
  fs.writeFileSync(infoEntidad.archivo, JSON.stringify(baseDatos, null, 2));
  console.log(`
🎉 ¡Extracción completada para ${infoEntidad.nombre}!`);
  console.log(`📁 Archivo guardado: ${infoEntidad.archivo} con ${baseDatos.length} vacantes completas.`);
}

// Ejecución por defecto para San Luis Potosí (ID 24) o pasa el ID que requieras
const idEntidadAProcesar = process.argv[2] || "24";
extraerDetallesVacantes(idEntidadAProcesar);
