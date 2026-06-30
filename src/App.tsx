import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  Clock,
  Database,
  Download,
  Droplets,
  ExternalLink,
  Filter,
  HeartPulse,
  MapPin,
  MessageCircle,
  Phone,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Trash2,
  Users
} from "lucide-react";

type Period = "all" | "day" | "week" | "month";
type DonationType = "SANGUE" | "PLAQUETAS";

type RecordItem = {
  id: string;
  donor_name: string;
  donation_type: DonationType;
  blood_type: string | null;
  patient_name: string | null;
  occurrence_date: string;
  occurrence_time: string;
  quantity_units: number;
  created_at: string;
};

type DonorSummary = {
  donor_name: string;
  donation_type: DonationType;
  blood_type: string | null;
  total_records: number;
  last_date: string;
};

type FormState = {
  donor_name: string;
  donation_type: DonationType;
  blood_type: string;
  patient_name: string;
  occurrence_date: string;
  occurrence_time: string;
  quantity_units: string;
};

const bloodTypes = ["", "A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];
const defaultPatientName = "GLORIA MARIA WANDERLEY CAPELO";
const contactName = "Ana Beatriz Lima Capelo";
const contactPhoneDisplay = "+55 85 99743-3586";
const contactPhoneDigits = "5585997433586";
const fujisanPhone = "(85) 4009.6612";
const doubtsPhone = "(85) 4009-6718";
const doubtsWhatsapp = "(85) 99754-3780";
const periods: Array<{ value: Period; label: string }> = [
  { value: "all", label: "Todos" },
  { value: "day", label: "Dia" },
  { value: "week", label: "Semana" },
  { value: "month", label: "Mes" }
];

const emptyForm = (): FormState => ({
  donor_name: "",
  donation_type: "SANGUE",
  blood_type: "",
  patient_name: defaultPatientName,
  occurrence_date: todayInput(),
  occurrence_time: currentTimeInput(),
  quantity_units: "1"
});

export default function App() {
  const [form, setForm] = useState<FormState>(emptyForm);
  const [records, setRecords] = useState<RecordItem[]>([]);
  const [donors, setDonors] = useState<DonorSummary[]>([]);
  const [period, setPeriod] = useState<Period>("all");
  const [referenceDate, setReferenceDate] = useState(todayInput());
  const [typeFilter, setTypeFilter] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const loadData = async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({
        period,
        date: referenceDate,
        type: typeFilter,
        search
      });
      const [recordsResponse, donorsResponse] = await Promise.all([
        fetch(`/.netlify/functions/records?${params.toString()}`),
        fetch("/.netlify/functions/donors")
      ]);

      const recordsData = await recordsResponse.json();
      const donorsData = await donorsResponse.json();

      if (!recordsResponse.ok) throw new Error(recordsData.error || "Erro ao carregar registros.");
      if (!donorsResponse.ok) throw new Error(donorsData.error || "Erro ao carregar doadores.");

      setRecords(recordsData.rows || []);
      setDonors(donorsData.rows || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao carregar dados.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [period, referenceDate, typeFilter]);

  const totals = useMemo(() => {
    const uniqueDonors = new Set(records.map((record) => record.donor_name.toLowerCase()));
    return {
      records: records.length,
      donors: uniqueDonors.size,
      blood: records.filter((record) => record.donation_type === "SANGUE").length,
      platelets: records.filter((record) => record.donation_type === "PLAQUETAS").length,
      units: records.reduce((sum, record) => sum + Number(record.quantity_units || 0), 0)
    };
  }, [records]);

  const recordsByDate = useMemo(() => {
    return records.reduce<Record<string, RecordItem[]>>((groups, record) => {
      groups[record.occurrence_date] = groups[record.occurrence_date] || [];
      groups[record.occurrence_date].push(record);
      return groups;
    }, {});
  }, [records]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    setNotice("");

    try {
      const response = await fetch("/.netlify/functions/records", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ...form,
          quantity_units: Number(form.quantity_units || 1)
        })
      });
      const data = await response.json();

      if (!response.ok) throw new Error(data.error || "Erro ao salvar registro.");

      setNotice("Registro salvo.");
      setForm({ ...emptyForm(), occurrence_date: form.occurrence_date });
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao salvar registro.");
    } finally {
      setSaving(false);
    }
  };

  const removeRecord = async (record: RecordItem) => {
    const ok = window.confirm(`Excluir o registro de ${record.donor_name} em ${formatDate(record.occurrence_date)}?`);
    if (!ok) return;

    setError("");
    try {
      const response = await fetch(`/.netlify/functions/records?id=${encodeURIComponent(record.id)}`, {
        method: "DELETE"
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Erro ao excluir registro.");
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao excluir registro.");
    }
  };

  const exportCsv = () => {
    const header = [
      "Data",
      "Hora",
      "Doador",
      "Tipo",
      "Tipo sanguineo",
      "Paciente",
      "Quantidade"
    ];
    const lines = records.map((record) => [
      record.occurrence_date,
      timeOnly(record.occurrence_time),
      record.donor_name,
      record.donation_type,
      record.blood_type || "",
      record.patient_name || "",
      String(record.quantity_units)
    ]);
    const csv = [header, ...lines].map((row) => row.map(csvCell).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `transfusoes-${period}-${referenceDate}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Campanha de doacao</p>
          <h1>Gloria Maria Wanderley Capelo</h1>
          <p className="topbar-subtitle">Registro de doadores, datas e horarios de sangue e plaquetas.</p>
        </div>
        <div className="topbar-actions">
          <div className="status-pill online" title="Persistencia no Neon via Netlify Functions">
            <Database size={16} />
            Livre para salvar
          </div>
        </div>
      </header>

      {(error || notice) && (
        <div className={error ? "alert error" : "alert success"}>{error || notice}</div>
      )}

      <section className="public-info">
        <div className="patient-banner">
          <div className="patient-copy">
            <div className="patient-icon">
              <HeartPulse size={28} />
            </div>
            <div>
              <p className="section-label">Paciente que vai receber</p>
              <h2>{defaultPatientName}</h2>
              <div className="patient-facts">
                <span>Sangue e plaquetas</span>
                <span>Fortaleza - CE</span>
                <span>Contato familiar: Bia Capelo</span>
              </div>
            </div>
          </div>
          <div className="contact-actions">
            <a
              className="primary-button link-button"
              href={`https://wa.me/${contactPhoneDigits}?text=${encodeURIComponent(
                `Oi Bia, quero falar sobre doacao de sangue ou plaquetas para ${defaultPatientName}.`
              )}`}
              target="_blank"
              rel="noreferrer"
            >
              <MessageCircle size={18} />
              Mandar mensagem para Bia
            </a>
            <a className="secondary-button link-button" href={`tel:+${contactPhoneDigits}`}>
              <Phone size={17} />
              {contactPhoneDisplay}
            </a>
          </div>
        </div>

      </section>

      <section className="section-heading">
        <div>
          <p className="section-label">Painel operacional</p>
          <h2>Nomes, dias e horarios registrados</h2>
        </div>
        <span>Dados salvos no Neon</span>
      </section>

      <section className="summary-grid" aria-label="Resumo">
        <Metric icon={<CalendarDays />} label="Registros" value={totals.records} />
        <Metric icon={<Users />} label="Doadores exibidos" value={totals.donors} />
        <Metric icon={<Droplets />} label="Sangue" value={totals.blood} />
        <Metric icon={<Droplets />} label="Plaquetas" value={totals.platelets} />
      </section>

      <section className="workspace">
        <form className="panel form-panel" onSubmit={handleSubmit}>
          <div className="panel-header">
            <div>
              <p className="section-label">Novo registro</p>
              <h2>Doador, dia e hora</h2>
            </div>
            <button className="primary-button" type="submit" disabled={saving}>
              <Plus size={18} />
              {saving ? "Salvando" : "Salvar"}
            </button>
          </div>

          <div className="form-grid">
            <label>
              Nome do doador
              <input
                value={form.donor_name}
                onChange={(event) => setForm({ ...form, donor_name: event.target.value })}
                placeholder="Nome completo"
                required
              />
            </label>

            <label>
              Tipo
              <select
                value={form.donation_type}
                onChange={(event) => setForm({ ...form, donation_type: event.target.value as DonationType })}
              >
                <option value="SANGUE">Sangue</option>
                <option value="PLAQUETAS">Plaquetas</option>
              </select>
            </label>

            <label>
              Tipo sanguineo
              <select
                value={form.blood_type}
                onChange={(event) => setForm({ ...form, blood_type: event.target.value })}
              >
                {bloodTypes.map((type) => (
                  <option key={type || "empty"} value={type}>
                    {type || "Nao informado"}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Data
              <input
                type="date"
                value={form.occurrence_date}
                onChange={(event) => setForm({ ...form, occurrence_date: event.target.value })}
                required
              />
            </label>

            <label>
              Hora
              <input
                type="time"
                value={form.occurrence_time}
                onChange={(event) => setForm({ ...form, occurrence_time: event.target.value })}
                required
              />
            </label>

            <label>
              Quantidade
              <input
                type="number"
                min="1"
                value={form.quantity_units}
                onChange={(event) => setForm({ ...form, quantity_units: event.target.value })}
              />
            </label>

            <label>
              Paciente
              <input
                value={form.patient_name}
                onChange={(event) => setForm({ ...form, patient_name: event.target.value })}
                placeholder="Opcional"
              />
            </label>
          </div>
        </form>

        <aside className="panel donors-panel">
          <div className="panel-header compact">
            <div>
              <p className="section-label">Doadores</p>
              <h2>Historico geral</h2>
            </div>
            <Users size={20} />
          </div>

          <div className="donor-list">
            {donors.length === 0 && (
              <p className="empty-state">Nenhum doador registrado.</p>
            )}
            {donors.map((donor) => (
              <div className="donor-row" key={`${donor.donor_name}-${donor.donation_type}-${donor.blood_type}`}>
                <div>
                  <strong>{donor.donor_name}</strong>
                  <span>{formatDonationType(donor.donation_type)} {donor.blood_type ? `• ${donor.blood_type}` : ""}</span>
                </div>
                <div className="donor-meta">
                  <b>{donor.total_records}</b>
                  <small>{donor.last_date ? formatDate(donor.last_date) : "-"}</small>
                </div>
              </div>
            ))}
          </div>
        </aside>
      </section>

      <section className="panel records-panel">
        <div className="panel-header">
          <div>
            <p className="section-label">Consulta</p>
            <h2>Todos os registros salvos</h2>
          </div>
          <div className="toolbar">
            <button type="button" className="icon-button" onClick={() => loadData()} title="Atualizar">
              <RefreshCw size={18} className={loading ? "spin" : ""} />
            </button>
            <button type="button" className="secondary-button" onClick={exportCsv} disabled={records.length === 0}>
              <Download size={17} />
              CSV
            </button>
          </div>
        </div>

        <div className="filters">
          <div className="segmented" aria-label="Periodo">
            {periods.map((item) => (
              <button
                key={item.value}
                className={period === item.value ? "active" : ""}
                type="button"
                onClick={() => setPeriod(item.value)}
              >
                {item.label}
              </button>
            ))}
          </div>

          <label className="filter-field">
            <CalendarDays size={16} />
            <input
              type="date"
              value={referenceDate}
              disabled={period === "all"}
              onChange={(event) => setReferenceDate(event.target.value)}
            />
          </label>

          <label className="filter-field">
            <Filter size={16} />
            <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}>
              <option value="">Todos</option>
              <option value="SANGUE">Sangue</option>
              <option value="PLAQUETAS">Plaquetas</option>
            </select>
          </label>

          <form className="search-field" onSubmit={(event) => { event.preventDefault(); loadData(); }}>
            <Search size={16} />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar doador ou paciente"
            />
            <button type="submit">Buscar</button>
          </form>
        </div>

        <div className="records-list">
          {loading && <p className="empty-state">Carregando registros...</p>}
          {!loading && records.length === 0 && (
            <p className="empty-state">Nenhum registro encontrado.</p>
          )}
          {!loading && Object.entries(recordsByDate).map(([date, group]) => (
            <div className="date-group" key={date}>
              <div className="date-heading">
                <strong>{formatDate(date)}</strong>
                <span>{group.length} registro{group.length === 1 ? "" : "s"}</span>
              </div>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Hora</th>
                      <th>Doador</th>
                      <th>Tipo</th>
                      <th>Paciente</th>
                      <th>Qtd.</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {group.map((record) => (
                      <tr key={record.id}>
                        <td className="time-cell"><Clock size={15} /> {timeOnly(record.occurrence_time)}</td>
                        <td>
                          <strong>{record.donor_name}</strong>
                          <span>{record.blood_type || "Tipo nao informado"}</span>
                        </td>
                        <td><Badge type={record.donation_type} /></td>
                        <td>{record.patient_name || "-"}</td>
                        <td>{record.quantity_units}</td>
                        <td className="actions-cell">
                          <button
                            type="button"
                            className="icon-button danger"
                            onClick={() => removeRecord(record)}
                            title="Excluir"
                          >
                            <Trash2 size={16} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="section-heading info-heading">
        <div>
          <p className="section-label">Informações para doação</p>
          <h2>Local, contato e requisitos</h2>
        </div>
      </section>

      <section className="info-grid">
        <article className="panel info-panel">
          <div className="panel-header compact">
            <div>
              <p className="section-label">Local da doação</p>
              <h2>Doação de sangue no Fujisan - Fortaleza - CE</h2>
            </div>
            <MapPin size={20} />
          </div>
          <ul className="info-list">
            <li><strong>Banco de sangue:</strong> Fujisan Centro de Hemoterapia e Hematologia do Ceará.</li>
            <li><strong>Segunda a sexta:</strong> 7:30h às 16:30h.</li>
            <li><strong>Sábado:</strong> 7:30h às 13:00h.</li>
            <li><strong>Endereço:</strong> Av. Barão de Studart, 2626 - Joaquim Távora, Fortaleza - CE, 60120-002.</li>
            <li><strong>Telefone:</strong> {fujisanPhone}</li>
            <li><strong>Dúvidas:</strong> {doubtsPhone} ou WhatsApp {doubtsWhatsapp}.</li>
            <li><strong>Instagram:</strong> @fujisanbs</li>
          </ul>
          <div className="inline-actions">
            <a
              className="secondary-button link-button"
              href="https://www.google.com/maps/search/?api=1&query=Av.%20Bar%C3%A3o%20de%20Studart%2C%202626%20Joaquim%20T%C3%A1vora%20Fortaleza%20CE"
              target="_blank"
              rel="noreferrer"
            >
              <ExternalLink size={17} />
              Abrir mapa
            </a>
            <a className="secondary-button link-button" href="tel:+558540096612">
              <Phone size={17} />
              Ligar Fujisan
            </a>
          </div>
        </article>

        <article className="panel info-panel">
          <div className="panel-header compact">
            <div>
              <p className="section-label">Antes de doar</p>
              <h2>Requisitos principais</h2>
            </div>
            <ShieldCheck size={20} />
          </div>
          <ul className="requirements-list">
            <li>Esteja alimentado, com refeições leves e não gordurosas nas 4 horas antes da doação.</li>
            <li>Não tenha ingerido bebida alcoólica nem usado maconha nas últimas 12 horas.</li>
            <li>Não esteja gripado, resfriado ou em processo alérgico.</li>
            <li>Não tenha tomado antibiótico nos últimos 15 dias.</li>
            <li>Tenha repousado bem na noite anterior.</li>
            <li>Esteja em boas condições de saúde, sem feridas ou machucados no corpo.</li>
            <li>Pese acima de 50 kg, com desconto das vestimentas.</li>
            <li>Tenha entre 18 e 69 anos, 11 meses e 29 dias.</li>
            <li>Doadores de 16 e 17 anos precisam da presença e autorização formal dos pais ou responsável legal.</li>
            <li>Para primeira doação, o limite de idade é 60 anos.</li>
            <li>Não tenha se exposto ao risco de contrair AIDS.</li>
            <li>Não tenha feito tatuagem, piercing ou micropigmentação nos últimos 12 meses.</li>
            <li>Não tenha diabetes.</li>
            <li>Não esteja grávida, com suspeita de gestação ou amamentando se o parto ocorreu há menos de 12 meses.</li>
            <li>Não vá acompanhado de crianças sem acompanhante na hora da doação.</li>
            <li>Leve documento oficial com foto: RG, carteira profissional, CNH ou equivalente.</li>
          </ul>
        </article>
      </section>
    </main>
  );
}

function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="metric">
      <div className="metric-icon">{icon}</div>
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
      </div>
    </div>
  );
}

function Badge({ type }: { type: DonationType }) {
  return <span className={`badge ${type === "PLAQUETAS" ? "platelets" : "blood"}`}>{formatDonationType(type)}</span>;
}

function todayInput() {
  const now = new Date();
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
  return now.toISOString().slice(0, 10);
}

function currentTimeInput() {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeZone: "UTC" }).format(new Date(`${value}T00:00:00Z`));
}

function timeOnly(value: string) {
  return value.slice(0, 5);
}

function formatDonationType(type: DonationType) {
  return type === "PLAQUETAS" ? "Plaquetas" : "Sangue";
}

function csvCell(value: string) {
  return `"${value.replace(/"/g, '""')}"`;
}
