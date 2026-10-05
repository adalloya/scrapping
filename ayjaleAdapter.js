const { createClient } = require('@supabase/supabase-js');

const ADMIN_COMPANY_ID = process.env.ADMIN_COMPANY_ID || '03da3979-111a-4d7e-b36c-ce99a4f298cd';

const CATEGORY_MAP = {
  'chofer': 'Logística y Transporte',
  'conductor': 'Logística y Transporte',
  'operador': 'Logística y Transporte',
  'transporte': 'Logística y Transporte',
  'logistica': 'Logística y Transporte',
  'repartidor': 'Logística y Transporte',
  'almacen': 'Almacén e Inventarios',
  'inventario': 'Almacén e Inventarios',
  'surtidor': 'Almacén e Inventarios',
  'produccion': 'Producción y Manufactura',
  'manufactura': 'Producción y Manufactura',
  'ensamblador': 'Producción y Manufactura',
  'mantenimiento': 'Mantenimiento y Reparaciones',
  'mecanico': 'Mantenimiento y Reparaciones',
  'limpieza': 'Limpieza y Servicios Generales',
  'servicios generales': 'Limpieza y Servicios Generales',
  'seguridad': 'Seguridad y Vigilancia',
  'vigilancia': 'Seguridad y Vigilancia',
  'guardia': 'Seguridad y Vigilancia',
  'atencion a clientes': 'Atención al Cliente',
  'cajero': 'Ventas y Comercio',
  'ventas': 'Ventas y Comercio',
  'comercio': 'Ventas y Comercio',
  'mostrador': 'Ventas y Comercio',
  'mesero': 'Hostelería y Turismo',
  'cocina': 'Hostelería y Turismo',
  'cocinero': 'Hostelería y Turismo',
  'construccion': 'Construcción y Obra',
  'administracion': 'Administrativo y Oficina',
  'oficina': 'Administrativo y Oficina',
  'auxiliar': 'Administrativo y Oficina',
  'recursos humanos': 'Recursos Humanos',
  'sistemas': 'Tecnología y Sistemas',
  'contabilidad': 'Contabilidad y Finanzas',
  'salud': 'Salud y Medicina',
  'enfermeria': 'Salud y Medicina'
};

// Palabras breves que deben mantenerse en minúsculas a menos que sean la primera palabra
const MINUSCULAS = new Set(['de', 'del', 'la', 'las', 'el', 'los', 'en', 'y', 'a', 'con', 'por', 'para', 'o', 'un', 'una']);

/**
 * Convierte un texto a Capital Case (Primera letra de cada palabra en mayúscula), respetando conectores.
 * Ejemplos:
 * "CHOFER VENDEDOR" -> "Chofer Vendedor"
 * "ventas clientes" -> "Ventas Clientes"
 * "auxiliar de almacen nocturno" -> "Auxiliar de Almacén Nocturno"
 */
function toCapitalCase(text) {
  if (!text) return 'Vacante';
  const palabras = text.trim().toLowerCase().split(/\s+/);
  
  return palabras.map((palabra, index) => {
    if (!palabra) return '';
    // Mantener conectores en minúscula salvo que sea la primera palabra del título
    if (index > 0 && MINUSCULAS.has(palabra)) {
      return palabra;
    }
    return palabra.charAt(0).toUpperCase() + palabra.slice(1);
  }).join(' ');
}

function normalizeCategory(rawPuesto = '') {
  const text = rawPuesto.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  for (const [key, categoryName] of Object.entries(CATEGORY_MAP)) {
    if (text.includes(key)) return categoryName;
  }
  return 'Otros';
}

function normalizeWorkType(rawType = '') {
  const t = rawType.toLowerCase();
  if (t.includes('remot') || t.includes('home')) return 'Remoto';
  if (t.includes('hibrid') || t.includes('híbrid')) return 'Híbrido';
  return 'Presencial';
}

function transformScrapedJobToAyjale(scrapedItem) {
  let salaryMin = null;
  let salaryMax = null;

  if (scrapedItem.salario_mensual_neto && scrapedItem.salario_mensual_neto !== 'No especificado') {
    const matches = scrapedItem.salario_mensual_neto.replace(/,/g, '').match(/\d+(\.\d+)?/g);
    if (matches && matches.length >= 2) {
      salaryMin = parseFloat(matches[0]);
      salaryMax = parseFloat(matches[1]);
    } else if (matches && matches.length === 1) {
      salaryMin = parseFloat(matches[0]);
      salaryMax = parseFloat(matches[0]);
    }
  }

  if (!salaryMin && scrapedItem.salario_numerico) {
    salaryMin = scrapedItem.salario_numerico;
  }

  let descripcionEnriquecida = (scrapedItem.descripcion || '').trim();

  let reqText = null;
  if (Array.isArray(scrapedItem.requisitos) && scrapedItem.requisitos.length > 0) {
    reqText = '- ' + scrapedItem.requisitos.join('\n- ');
    descripcionEnriquecida += '\n\n**Requisitos:**\n• ' + scrapedItem.requisitos.join('\n• ');
  }

  if (Array.isArray(scrapedItem.funciones_actividades) && scrapedItem.funciones_actividades.length > 0) {
    descripcionEnriquecida += '\n\n**Funciones y Actividades:**\n• ' + scrapedItem.funciones_actividades.join('\n• ');
  }

  if (Array.isArray(scrapedItem.horario) && scrapedItem.horario.length > 0) {
    descripcionEnriquecida += '\n\n**Horario:**\n• ' + scrapedItem.horario.join('\n• ');
  }

  let benText = null;
  if (Array.isArray(scrapedItem.prestaciones) && scrapedItem.prestaciones.length > 0) {
    benText = '- ' + scrapedItem.prestaciones.join('\n- ');
    descripcionEnriquecida += '\n\n**Prestaciones:**\n• ' + scrapedItem.prestaciones.join('\n• ');
  }

  if (Array.isArray(scrapedItem.proceso_reclutamiento) && scrapedItem.proceso_reclutamiento.length > 0) {
    descripcionEnriquecida += '\n\n**Contacto / Postulación:**\n• ' + scrapedItem.proceso_reclutamiento.join('\n• ');
  }

  if (scrapedItem.url_vacante) {
    descripcionEnriquecida += `\n\n[Ver publicación original en Portal del Empleo](${scrapedItem.url_vacante})`;
  }

  const nombreEmpresa = (scrapedItem.empresa || 'Empresa').trim();
  const logoEmpresa = scrapedItem.empresa_logo || null;

  // Aplicar formateo Capital Case al título del puesto
  const tituloPuestoFormatted = toCapitalCase(scrapedItem.puesto);

  return {
    source: 'scraper_sne',
    source_id: String(scrapedItem.folio),
    company_id: ADMIN_COMPANY_ID,
    
    empresa_override: nombreEmpresa,
    logo_override: logoEmpresa,

    title: tituloPuestoFormatted,
    description: descripcionEnriquecida,
    category: normalizeCategory(scrapedItem.puesto),
    location: (scrapedItem.ubicacion || `${scrapedItem.municipio || ''}, ${scrapedItem.estado || ''}`).trim(),
    type: normalizeWorkType(scrapedItem.tipo_contratacion || ''),
    salary_min: salaryMin,
    salary_max: salaryMax,
    salary: scrapedItem.salario_mensual_neto || 'No especificado',
    salary_currency: 'MXN',
    currency: 'MXN',
    salary_period: 'mensual',
    hide_salary: Boolean(scrapedItem.salario_mensual_neto === 'No especificado' || !salaryMin),
    is_confidential: Boolean(scrapedItem.empresa === 'Confidencial'),
    requirements: reqText,
    benefits: benText,
    active: true,
    is_active: true,
    expires_at: scrapedItem.fecha_vigencia || null
  };
}

async function syncJobsToAyjaleSupabase(supabaseClient, scrapedJobsList, logCallback = console.log) {
  if (!supabaseClient) {
    logCallback('⚠️ Supabase no está configurado en .env. Se omitió la subida a la tabla jobs.');
    return;
  }

  logCallback(`🚀 Transformando ${scrapedJobsList.length} vacantes con Capital Case en títulos...`);
  const ayjaleJobsPayload = scrapedJobsList.map(transformScrapedJobToAyjale);

  const BATCH_SIZE = 50;
  let successCount = 0;

  for (let i = 0; i < ayjaleJobsPayload.length; i += BATCH_SIZE) {
    const batch = ayjaleJobsPayload.slice(i, i + BATCH_SIZE);
    logCallback(`📦 Sincronizando lote ${Math.floor(i / BATCH_SIZE) + 1} (${batch.length} vacantes a tabla jobs)...`);
    
    try {
      const sourceIds = batch.map(j => j.source_id);
      const { data: existingJobs } = await supabaseClient
        .from('jobs')
        .select('id, source_id')
        .in('source_id', sourceIds);

      const existingMap = new Map();
      if (existingJobs) {
        existingJobs.forEach(ej => existingMap.set(ej.source_id, ej.id));
      }

      const toUpdate = [];
      const toInsert = [];

      for (const item of batch) {
        if (existingMap.has(item.source_id)) {
          toUpdate.push({ ...item, id: existingMap.get(item.source_id) });
        } else {
          toInsert.push(item);
        }
      }

      let batchCount = 0;

      if (toInsert.length > 0) {
        const { data: insData, error: insError } = await supabaseClient
          .from('jobs')
          .insert(toInsert)
          .select('id');
        if (insError) {
          logCallback(`  ❌ Error al insertar sub-lote: ${insError.message}`);
        } else {
          batchCount += (insData ? insData.length : toInsert.length);
        }
      }

      if (toUpdate.length > 0) {
        for (const upItem of toUpdate) {
          const { error: upError } = await supabaseClient
            .from('jobs')
            .update(upItem)
            .eq('id', upItem.id);
          if (upError) {
            logCallback(`  ❌ Error al actualizar vacante ${upItem.source_id}: ${upError.message}`);
          } else {
            batchCount++;
          }
        }
      }

      successCount += batchCount;
      logCallback(`✅ Lote procesado con éxito: ${batchCount} vacantes sincronizadas con títulos en Capital Case.`);

    } catch (e) {
      logCallback(`❌ Excepción al subir lote: ${e.message}`);
    }
  }

  logCallback(`🎉 Sincronización finalizada: ${successCount} vacantes actualizadas en AyJale.com.`);
}

module.exports = {
  transformScrapedJobToAyjale,
  syncJobsToAyjaleSupabase,
  normalizeCategory,
  toCapitalCase
};
