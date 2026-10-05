require("../dotenv").config();
const { ejecutarScraperNacional } = require("../scraper");

module.exports = async function handler(req, res) {
  // Verificar cabecera de Vercel Cron o token si aplica
  console.log("⏰ Vercel Cron iniciado...");
  try {
    const resultado = await ejecutarScraperNacional((msg) => console.log(msg), true);
    res.status(200).json({ ok: true, mensaje: "Sincronización nacional en Vercel ejecutada con éxito.", resultado });
  } catch (err) {
    console.error("❌ Error en Vercel Cron:", err);
    res.status(500).json({ ok: false, error: err.message });
  }
};
