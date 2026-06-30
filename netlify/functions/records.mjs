import { randomUUID } from "node:crypto";
import { ensureSchema, getPeriodBounds, getSql, json } from "./_db.mjs";

export async function handler(event) {
  try {
    await ensureSchema();

    if (event.httpMethod === "GET") {
      return await listRecords(event);
    }

    if (event.httpMethod === "POST") {
      return await createRecord(event);
    }

    if (event.httpMethod === "DELETE") {
      return await deleteRecord(event);
    }

    return json(405, { error: "Metodo nao permitido." });
  } catch (error) {
    return json(500, { error: error.message || "Erro interno." });
  }
}

async function listRecords(event) {
  const sql = getSql();
  const params = event.queryStringParameters || {};
  const period = params.period || "day";
  const { startDate, endDate } = getPeriodBounds(period, params.date);
  const type = params.type || "";
  const search = (params.search || "").trim().toLowerCase();

  const rows = await sql`
    SELECT
      id,
      donor_name,
      donation_type,
      blood_type,
      patient_name,
      clinic_location,
      occurrence_date::text AS occurrence_date,
      occurrence_time::text AS occurrence_time,
      quantity_units,
      notes,
      created_at::text AS created_at
    FROM transfusion_records
    WHERE occurrence_date >= ${startDate}::date
      AND occurrence_date < ${endDate}::date
      AND (${type} = '' OR donation_type = ${type})
      AND (
        ${search} = ''
        OR lower(donor_name) LIKE ${`%${search}%`}
        OR lower(COALESCE(patient_name, '')) LIKE ${`%${search}%`}
        OR lower(COALESCE(clinic_location, '')) LIKE ${`%${search}%`}
      )
    ORDER BY occurrence_date DESC, occurrence_time DESC, created_at DESC
  `;

  return json(200, { rows, bounds: { startDate, endDate } });
}

async function createRecord(event) {
  const sql = getSql();
  const body = JSON.parse(event.body || "{}");
  const record = validateRecord(body);
  const id = randomUUID();

  const rows = await sql`
    INSERT INTO transfusion_records (
      id,
      donor_name,
      donation_type,
      blood_type,
      patient_name,
      clinic_location,
      occurrence_date,
      occurrence_time,
      quantity_units,
      notes
    )
    VALUES (
      ${id},
      ${record.donor_name},
      ${record.donation_type},
      ${record.blood_type},
      ${record.patient_name},
      ${record.clinic_location},
      ${record.occurrence_date}::date,
      ${record.occurrence_time}::time,
      ${record.quantity_units},
      ${record.notes}
    )
    RETURNING
      id,
      donor_name,
      donation_type,
      blood_type,
      patient_name,
      clinic_location,
      occurrence_date::text AS occurrence_date,
      occurrence_time::text AS occurrence_time,
      quantity_units,
      notes,
      created_at::text AS created_at
  `;

  return json(201, { record: rows[0] });
}

async function deleteRecord(event) {
  const sql = getSql();
  const id = event.queryStringParameters?.id;

  if (!id) {
    return json(400, { error: "Informe o id do registro." });
  }

  await sql`DELETE FROM transfusion_records WHERE id = ${id}`;
  return json(200, { ok: true });
}

function validateRecord(body) {
  const donorName = String(body.donor_name || "").trim();
  const donationType = String(body.donation_type || "").trim().toUpperCase();
  const occurrenceDate = String(body.occurrence_date || "").trim();
  const occurrenceTime = String(body.occurrence_time || "").trim();
  const quantityUnits = Number(body.quantity_units || 1);

  if (!donorName) throw new Error("Informe o nome do doador.");
  if (!["SANGUE", "PLAQUETAS"].includes(donationType)) throw new Error("Tipo deve ser SANGUE ou PLAQUETAS.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(occurrenceDate)) throw new Error("Informe a data no formato correto.");
  if (!/^\d{2}:\d{2}$/.test(occurrenceTime)) throw new Error("Informe a hora no formato correto.");
  if (!Number.isFinite(quantityUnits) || quantityUnits < 1) throw new Error("A quantidade deve ser maior que zero.");

  return {
    donor_name: donorName,
    donation_type: donationType,
    blood_type: emptyToNull(body.blood_type),
    patient_name: emptyToNull(body.patient_name),
    clinic_location: emptyToNull(body.clinic_location),
    occurrence_date: occurrenceDate,
    occurrence_time: occurrenceTime,
    quantity_units: Math.round(quantityUnits),
    notes: emptyToNull(body.notes)
  };
}

function emptyToNull(value) {
  const text = String(value || "").trim();
  return text || null;
}
