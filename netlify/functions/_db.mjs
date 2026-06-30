import { neon } from "@neondatabase/serverless";

let client;
let schemaReady = false;

export function getSql() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL nao configurada. Adicione a string do Neon nas variaveis de ambiente do Netlify.");
  }

  if (!client) {
    client = neon(process.env.DATABASE_URL);
  }

  return client;
}

export async function ensureSchema() {
  if (schemaReady) return;

  const sql = getSql();
  await sql`
    CREATE TABLE IF NOT EXISTS transfusion_records (
      id text PRIMARY KEY,
      donor_name text NOT NULL,
      donation_type text NOT NULL CHECK (donation_type IN ('SANGUE', 'PLAQUETAS')),
      blood_type text,
      patient_name text,
      clinic_location text,
      occurrence_date date NOT NULL,
      occurrence_time time NOT NULL,
      quantity_units integer NOT NULL DEFAULT 1,
      notes text,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS transfusion_records_date_idx ON transfusion_records (occurrence_date)`;
  await sql`CREATE INDEX IF NOT EXISTS transfusion_records_donor_idx ON transfusion_records (lower(donor_name))`;
  schemaReady = true;
}

export function json(statusCode, body) {
  return {
    statusCode,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store"
    },
    body: JSON.stringify(body)
  };
}

export function getPeriodBounds(period, referenceDate) {
  if (period === "all") {
    return {
      startDate: "0001-01-01",
      endDate: "9999-12-31"
    };
  }

  const base = parseDate(referenceDate);
  const start = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), base.getUTCDate()));
  let end = new Date(start);

  if (period === "week") {
    const day = start.getUTCDay();
    const mondayOffset = day === 0 ? -6 : 1 - day;
    start.setUTCDate(start.getUTCDate() + mondayOffset);
    end = new Date(start);
    end.setUTCDate(start.getUTCDate() + 7);
  } else if (period === "month") {
    start.setUTCDate(1);
    end = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1));
  } else {
    end.setUTCDate(start.getUTCDate() + 1);
  }

  return {
    startDate: toDateOnly(start),
    endDate: toDateOnly(end)
  };
}

function parseDate(value) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return new Date();
  }

  return new Date(`${value}T00:00:00.000Z`);
}

function toDateOnly(date) {
  return date.toISOString().slice(0, 10);
}
