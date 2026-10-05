-- Script SQL para agregar los campos de override en la tabla jobs de Ayjale.com

ALTER TABLE jobs ADD COLUMN IF NOT EXISTS empresa_override TEXT;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS logo_override TEXT;

COMMENT ON COLUMN jobs.empresa_override IS 'Nombre de la empresa para bypass de vacantes del scraper';
COMMENT ON COLUMN jobs.logo_override IS 'URL del logotipo para bypass de vacantes del scraper';
