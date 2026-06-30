import { ensureSchema, getSql, json } from "./_db.mjs";

export async function handler() {
  try {
    await ensureSchema();
    const sql = getSql();
    const rows = await sql`
      SELECT
        donor_name,
        donation_type,
        blood_type,
        COUNT(*)::int AS total_records,
        MAX(occurrence_date)::text AS last_date,
        MAX(created_at)::text AS last_created_at
      FROM transfusion_records
      GROUP BY donor_name, donation_type, blood_type
      ORDER BY lower(donor_name), donation_type
    `;

    return json(200, { rows });
  } catch (error) {
    return json(500, { error: error.message || "Erro interno." });
  }
}
