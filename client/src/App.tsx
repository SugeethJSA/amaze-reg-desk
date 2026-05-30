import { Activity, Camera, CameraOff, Download, Edit3, LogOut, Plus, QrCode, RefreshCcw, Save, Send, ShieldCheck, Trash2, Upload, Users, X } from "lucide-react";
import { Html5Qrcode } from "html5-qrcode";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { API_URL, api, getSession, setSession, type Session } from "./api";
import { decryptQrPayload, hasEncryptedQrShape, hashPayload } from "./crypto";
import { deviceId, enqueueScan, flushScans, listQueuedScans } from "./offlineQueue";

type View = "dashboard" | "admin" | "scanner";
type Station = "entry" | "food" | "kit" | "custom";
type AdminTab = "registrations" | "form" | "qr" | "rules" | "users" | "verification";
type UserRow = {
  id: string;
  name: string;
  email: string;
  role: "admin" | "volunteer";
  active: boolean;
  categoryId?: string | null;
  categoryName?: string | null;
  categoryColor?: string | null;
  stations: Station[];
};
type UserCategory = {
  id: string;
  name: string;
  description: string;
  color: string;
  stationPermissions: Station[];
  capabilities: Record<string, boolean>;
  active: boolean;
  userCount?: number;
};
type ChartDatum = {
  label: string;
  value: number;
  tone?: "ok" | "warn" | "info";
};
type CustomFieldBreakdown = {
  fieldKey: string;
  label: string;
  fieldType: "select" | "checkbox";
  values: Array<{ label: string; count: number }>;
};
type FormField = {
  id: string;
  fieldKey: string;
  label: string;
  fieldType: "text" | "email" | "phone" | "number" | "select" | "textarea" | "checkbox";
  required: boolean;
  options: string[];
  sortOrder: number;
  active: boolean;
  showInList: boolean;
};

// Fallback dynamic fields to ensure unseeded systems load perfectly
const DEFAULT_FIELDS: FormField[] = [
  { id: "f-name", fieldKey: "name", label: "Full Name", fieldType: "text", required: true, options: [], sortOrder: 1, active: true, showInList: true },
  { id: "f-email", fieldKey: "email", label: "Email Address", fieldType: "email", required: true, options: [], sortOrder: 2, active: true, showInList: true },
  { id: "f-phone", fieldKey: "phone", label: "Phone Number", fieldType: "phone", required: false, options: [], sortOrder: 3, active: true, showInList: true },
  { id: "f-college", fieldKey: "college", label: "Club Name / Institution", fieldType: "text", required: false, options: [], sortOrder: 4, active: true, showInList: true },
  { id: "f-dept", fieldKey: "department", label: "Booking ID / Area Code", fieldType: "text", required: false, options: [], sortOrder: 5, active: true, showInList: true }
];

export function App() {
  const [session, setSessionState] = useState<Session | null>(getSession());
  const [view, setView] = useState<View>("dashboard");
  const [publicView, setPublicView] = useState<"login" | "register" | "transfer">("login");

  if (!session) {
    if (publicView === "register") {
      return <PublicRegister onBack={() => setPublicView("login")} />;
    }
    if (publicView === "transfer") {
      return <PublicTransfer onBack={() => setPublicView("login")} />;
    }
    return (
      <Login
        onLogin={(next) => {
          setSession(next);
          setSessionState(next);
        }}
        onNavigateRegister={() => setPublicView("register")}
        onNavigateTransfer={() => setPublicView("transfer")}
      />
    );
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="brand">
          <span className="brand-mark">A</span>
          <div>
            <p className="eyebrow">Amaze</p>
            <h1>Reg Desk</h1>
          </div>
        </div>
        <nav className="top-nav">
          {session.user.role === "admin" && (
            <>
              <button className={view === "dashboard" ? "active" : ""} onClick={() => setView("dashboard")}><Activity size={18} /> Dashboard</button>
              <button className={view === "admin" ? "active" : ""} onClick={() => setView("admin")}><Users size={18} /> Admin</button>
            </>
          )}
          <button className={view === "scanner" ? "active" : ""} onClick={() => setView("scanner")}><QrCode size={18} /> Volunteer Workstation</button>
        </nav>
        <div className="account-bar">
          <div>
            <p className="eyebrow">Signed in as {session.user.role}</p>
            <strong>{session.user.name}</strong>
          </div>
          <button className="icon-button" aria-label="Sign out" title="Sign out" onClick={() => {
            setSession(null);
            setSessionState(null);
          }}><LogOut size={18} /></button>
        </div>
      </header>
      <main className="content">
        <header className="page-heading">
          <div>
            <p className="eyebrow">Event operations</p>
            <h2>
              {view === "dashboard"
                ? "Live control center"
                : view === "admin"
                ? "Registration management"
                : "Volunteer workstation"}
            </h2>
          </div>
        </header>
        {view === "dashboard" && <Dashboard />}
        {view === "admin" && <Admin />}
        {view === "scanner" && <VolunteerWorkstation session={session} />}
      </main>
    </div>
  );
}

function Login({
  onLogin,
  onNavigateRegister,
  onNavigateTransfer
}: {
  onLogin: (session: Session) => void;
  onNavigateRegister: () => void;
  onNavigateTransfer: () => void;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    try {
      const session = await api<Session>("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password })
      });
      onLogin(session);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed.");
    }
  }

  return (
    <main className="login-page">
      <form onSubmit={submit} className="login-panel">
        <p className="eyebrow">Event operations</p>
        <h1 style={{ fontSize: "28px", fontWeight: "900", letterSpacing: "-0.03em" }}>Amaze Reg Desk</h1>
        <label>Email<input value={email} onChange={(event) => setEmail(event.target.value)} type="email" required /></label>
        <label>Password<input value={password} onChange={(event) => setPassword(event.target.value)} type="password" required /></label>
        {error && <p className="error">{error}</p>}
        <button type="submit" style={{ width: "100%", marginTop: "10px" }}>Sign in</button>
        <div style={{ marginTop: "24px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
          <button type="button" className="secondary" onClick={onNavigateRegister}>Register</button>
          <button type="button" className="secondary" onClick={onNavigateTransfer}>Transfer</button>
        </div>
      </form>
    </main>
  );
}

function Dashboard() {
  const [stats, setStats] = useState<any>(null);
  const [error, setError] = useState("");

  async function load() {
    try {
      setStats(await api("/stats/dashboard"));
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load stats.");
    }
  }

  useEffect(() => {
    load();
    const interval = window.setInterval(load, 5000);
    return () => window.clearInterval(interval);
  }, []);

  const cards = useMemo(() => [
    ["Registrations", stats?.attendees?.total ?? 0],
    ["QR sent", stats?.qr?.sent ?? 0],
    ["QR unsent", stats?.qr?.unsent ?? 0],
    ["Accepted scans", stats?.scans?.accepted ?? 0],
    ["Food claimed", stats?.scans?.food ?? 0],
    ["Kit claimed", stats?.scans?.kit ?? 0],
    ["Duplicates", stats?.scans?.duplicate ?? 0],
    ["Denied", stats?.scans?.denied ?? 0]
  ], [stats]);
  const qrTotal = Number(stats?.qr?.total ?? 0);
  const attendeeTotal = Number(stats?.attendees?.total ?? 0);
  const scanTotal = Number(stats?.scans?.total ?? 0);
  const acceptedScans = Number(stats?.scans?.accepted ?? 0);
  const duplicateScans = Number(stats?.scans?.duplicate ?? 0);
  const deniedScans = Number(stats?.scans?.denied ?? 0);
  const pendingScans = Number(stats?.scans?.pending ?? 0);
  const foodClaimed = Number(stats?.scans?.food ?? 0);
  const kitClaimed = Number(stats?.scans?.kit ?? 0);
  const qrSentPercent = qrTotal ? Math.round((Number(stats?.qr?.sent ?? 0) / qrTotal) * 100) : 0;
  const checkInPercent = attendeeTotal ? Math.round((acceptedScans / attendeeTotal) * 100) : 0;
  const issueCount = duplicateScans + deniedScans;
  const maxTimeline = Math.max(1, ...(stats?.timeline ?? []).map((row: any) => Number(row.count)));
  const maxStationActivity = Math.max(1, ...(stats?.stations ?? []).map((row: any) => Number(row.count)));
  const stationTotals = (stats?.stationTotals ?? []) as Array<{ station: string; count: number }>;
  const stationAccepted = (station: Station) => Number((stats?.stations ?? []).find((row: any) => row.station === station && row.status === "accepted")?.count ?? 0);
  const resourceBase = acceptedScans || attendeeTotal;
  const progressSections = [
    {
      title: "Registration funnel",
      items: [
        { label: "Registrations captured", value: attendeeTotal ? 100 : 0, detail: `${attendeeTotal} total registrations` },
        { label: "QR generated", value: percent(qrTotal, attendeeTotal), detail: `${qrTotal}/${attendeeTotal} QR records` },
        { label: "QR sent", value: percent(Number(stats?.qr?.sent ?? 0), qrTotal), detail: `${stats?.qr?.sent ?? 0}/${qrTotal} sent` },
        { label: "Checked in", value: percent(acceptedScans, attendeeTotal), detail: `${acceptedScans}/${attendeeTotal} accepted scans` }
      ]
    },
    {
      title: "Scan health",
      items: [
        { label: "Accepted rate", value: percent(acceptedScans, scanTotal), detail: `${acceptedScans}/${scanTotal} scans accepted` },
        { label: "Duplicate rate", value: percent(duplicateScans, scanTotal), detail: `${duplicateScans}/${scanTotal} duplicate scans`, tone: "warn" as const },
        { label: "Denied rate", value: percent(deniedScans, scanTotal), detail: `${deniedScans}/${scanTotal} denied scans`, tone: "warn" as const },
        { label: "Pending sync", value: percent(pendingScans, scanTotal), detail: `${pendingScans}/${scanTotal} pending scans`, tone: "info" as const }
      ]
    },
    {
      title: "Resource fulfillment",
      items: [
        { label: "Food claimed", value: percent(foodClaimed, resourceBase), detail: `${foodClaimed}/${resourceBase} food claims` },
        { label: "Kit claimed", value: percent(kitClaimed, resourceBase), detail: `${kitClaimed}/${resourceBase} kit claims` },
        { label: "Food remaining estimate", value: 100 - percent(foodClaimed, attendeeTotal), detail: `${Math.max(0, attendeeTotal - foodClaimed)} remaining estimate`, tone: "info" as const },
        { label: "Kit remaining estimate", value: 100 - percent(kitClaimed, attendeeTotal), detail: `${Math.max(0, attendeeTotal - kitClaimed)} remaining estimate`, tone: "info" as const }
      ]
    },
    {
      title: "Station progress",
      items: (["entry", "food", "kit", "custom"] as Station[]).map((station) => ({
        label: `${station} accepted`,
        value: percent(stationAccepted(station), station === "food" || station === "kit" ? resourceBase : attendeeTotal),
        detail: `${stationAccepted(station)}/${station === "food" || station === "kit" ? resourceBase : attendeeTotal} accepted`
      }))
    }
  ];
  const qrChart: ChartDatum[] = [
    { label: "Sent", value: Number(stats?.qr?.sent ?? 0), tone: "ok" },
    { label: "Unsent", value: Number(stats?.qr?.unsent ?? 0), tone: "warn" }
  ];
  const scanChart: ChartDatum[] = [
    { label: "Accepted", value: acceptedScans, tone: "ok" },
    { label: "Duplicate", value: duplicateScans, tone: "warn" },
    { label: "Denied", value: deniedScans, tone: "warn" },
    { label: "Pending", value: pendingScans, tone: "info" }
  ];
  const stationChart: ChartDatum[] = stationTotals.map((row) => ({ label: row.station, value: Number(row.count), tone: "info" }));

  return (
    <section className="stack">
      <div className="section-title">
        <h2>Live statistics</h2>
        <button className="secondary" onClick={load}><RefreshCcw size={16} /> Refresh</button>
      </div>
      {error && <p className="error">{error}</p>}
      <div className="metric-grid">
        {cards.map(([label, value]) => <article className="metric" key={label}><span>{label}</span><strong>{value}</strong></article>)}
      </div>
      <div className="dashboard-grid">
        <div className="panel">
          <h3>Event progress</h3>
          <ProgressBar label="QR delivery" value={qrSentPercent} detail={`${stats?.qr?.sent ?? 0}/${qrTotal} sent`} />
          <ProgressBar label="Check-in progress" value={checkInPercent} detail={`${acceptedScans}/${attendeeTotal} checked in`} />
          <ProgressBar label="Issue count" value={Math.min(100, issueCount * 8)} detail={`${issueCount} duplicate or denied scans`} tone="warn" />
        </div>
        <div className="panel">
          <h3>Scan timeline</h3>
          <div className="bar-chart">
            {(stats?.timeline?.length ? stats.timeline : [{ label: "No scans", count: 0 }]).map((row: any) => (
              <div className="bar-column" key={row.label}>
                <div className="bar-track"><span style={{ height: `${Math.max(4, (Number(row.count) / maxTimeline) * 100)}%` }} /></div>
                <small>{row.label}</small>
              </div>
            ))}
          </div>
        </div>
        <div className="panel full-span">
          <h3>Station activity</h3>
          <div className="station-bars">
            {(stats?.stations ?? []).map((row: any) => (
              <div className="station-row" key={`${row.station}-${row.status}`}>
                <span>{row.station} - {row.status}</span>
                <div><b style={{ width: `${Math.max(4, (Number(row.count) / maxStationActivity) * 100)}%` }} /></div>
                <strong>{row.count}</strong>
              </div>
            ))}
          </div>
        </div>
        <DonutChart title="QR status" data={qrChart} />
        <DonutChart title="Scan results" data={scanChart} />
        <HorizontalBarChart title="Station distribution" data={stationChart} />
        <HorizontalBarChart title="Resource usage" data={[
          { label: "Food claimed", value: foodClaimed, tone: "ok" },
          { label: "Kit claimed", value: kitClaimed, tone: "info" }
        ]} />
        {progressSections.map((section) => <ProgressSection key={section.title} title={section.title} items={section.items} />)}
        <div className="panel full-span">
          <h3>Custom field breakdowns</h3>
          <div className="custom-breakdown-grid">
            {((stats?.customFieldBreakdowns ?? []) as CustomFieldBreakdown[]).length > 0
              ? ((stats?.customFieldBreakdowns ?? []) as CustomFieldBreakdown[]).map((breakdown) => <CustomFieldBreakdownPanel key={breakdown.fieldKey} breakdown={breakdown} />)
              : <p className="empty-state">No responses yet.</p>}
          </div>
        </div>
      </div>
    </section>
  );
}

function percent(value: number, total: number) {
  return total > 0 ? Math.round((value / total) * 100) : 0;
}

function ProgressSection({ title, items }: { title: string; items: Array<{ label: string; value: number; detail: string; tone?: "ok" | "warn" | "info" }> }) {
  return (
    <div className="panel">
      <h3>{title}</h3>
      {items.map((item) => <ProgressBar key={item.label} {...item} />)}
    </div>
  );
}

function ProgressBar({ label, value, detail, tone = "ok" }: { label: string; value: number; detail: string; tone?: "ok" | "warn" | "info" }) {
  return (
    <div className="progress-row">
      <div>
        <strong>{label}</strong>
        <span>{detail}</span>
      </div>
      <div className={`progress-track ${tone}`}><b style={{ width: `${Math.max(0, Math.min(100, value))}%` }} /></div>
      <em>{value}%</em>
    </div>
  );
}

function DonutChart({ title, data }: { title: string; data: ChartDatum[] }) {
  const total = data.reduce((sum, item) => sum + item.value, 0);
  let offset = 25;
  const segments = data.map((item) => {
    const length = total ? (item.value / total) * 100 : 0;
    const segment = { ...item, length, offset };
    offset -= length;
    return segment;
  });

  return (
    <div className="panel chart-panel">
      <h3>{title}</h3>
      <div className="donut-layout">
        <svg className="donut-chart" viewBox="0 0 42 42" role="img" aria-label={title}>
          <circle className="donut-ring" cx="21" cy="21" r="15.915" />
          {segments.map((segment) => (
            <circle
              className={`donut-segment ${segment.tone ?? "info"}`}
              cx="21"
              cy="21"
              key={segment.label}
              r="15.915"
              strokeDasharray={`${segment.length} ${100 - segment.length}`}
              strokeDashoffset={segment.offset}
            />
          ))}
          <text x="21" y="20" textAnchor="middle">{total}</text>
          <text x="21" y="25" textAnchor="middle">total</text>
        </svg>
        <div className="chart-legend">
          {data.map((item) => <span key={item.label}><b className={item.tone ?? "info"} /> {item.label}: {item.value}</span>)}
        </div>
      </div>
    </div>
  );
}

function HorizontalBarChart({ title, data }: { title: string; data: ChartDatum[] }) {
  const max = Math.max(1, ...data.map((item) => item.value));
  return (
    <div className="panel">
      <h3>{title}</h3>
      <div className="horizontal-bars">
        {data.length > 0 ? data.map((item) => (
          <div className="horizontal-bar-row" key={item.label}>
            <span>{item.label}</span>
            <div><b className={item.tone ?? "info"} style={{ width: `${Math.max(4, (item.value / max) * 100)}%` }} /></div>
            <strong>{item.value}</strong>
          </div>
        )) : <p className="empty-state">No data yet.</p>}
      </div>
    </div>
  );
}

function CustomFieldBreakdownPanel({ breakdown }: { breakdown: CustomFieldBreakdown }) {
  const max = Math.max(1, ...breakdown.values.map((item) => item.count));
  return (
    <div className="breakdown-card">
      <h4>{breakdown.label}</h4>
      <div className="horizontal-bars compact">
        {breakdown.values.length > 0 ? breakdown.values.map((item) => (
          <div className="horizontal-bar-row" key={item.label}>
            <span>{item.label}</span>
            <div><b className="info" style={{ width: `${Math.max(4, (item.count / max) * 100)}%` }} /></div>
            <strong>{item.count}</strong>
          </div>
        )) : <p className="empty-state">No responses yet.</p>}
      </div>
    </div>
  );
}

function Admin() {
  const [tab, setTab] = useState<AdminTab>("registrations");
  const [file, setFile] = useState<File | null>(null);
  const [message, setMessage] = useState("");
  const [attendees, setAttendees] = useState<any[]>([]);
  const [fields, setFields] = useState<FormField[]>([]);
  const [editingFieldId, setEditingFieldId] = useState<string | null>(null);
  const [fieldForm, setFieldForm] = useState({
    fieldKey: "",
    label: "",
    fieldType: "text",
    required: false,
    options: "",
    sortOrder: 0,
    active: true,
    showInList: false
  });
  const [ruleForm, setRuleForm] = useState({ name: "", station: "entry", startsAt: "", endsAt: "" });
  const [users, setUsers] = useState<UserRow[]>([]);
  const [scopes, setScopes] = useState<Station[]>(["entry", "food", "kit", "custom"]);
  const [categories, setCategories] = useState<UserCategory[]>([]);
  const [capabilityKeys, setCapabilityKeys] = useState<string[]>([]);
  const [userSubTab, setUserSubTab] = useState<"users" | "categories">("users");
  
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [userForm, setUserForm] = useState({ name: "", email: "", password: "", role: "volunteer", active: true, stations: "entry", categoryId: "" });
  
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [categoryForm, setCategoryForm] = useState({ name: "", description: "", color: "#6366f1", active: true, stationPermissions: "", capabilities: {} as Record<string, boolean> });

  async function loadAttendees() {
    try {
      const response = await api<{ attendees: any[] }>("/attendees");
      setAttendees(response.attendees);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Failed to load attendees.");
    }
  }

  async function loadFields() {
    try {
      const response = await api<{ fields: FormField[] }>("/form-fields");
      setFields(response.fields);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Failed to load form fields.");
    }
  }

  async function loadUsers() {
    try {
      const response = await api<{ users: UserRow[]; scopes: Station[] }>("/auth/users");
      setUsers(response.users);
      setScopes(response.scopes);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Failed to load users.");
    }
  }

  async function loadCategories() {
    try {
      const response = await api<{ categories: UserCategory[]; capabilityKeys: string[] }>("/categories");
      setCategories(response.categories);
      setCapabilityKeys(response.capabilityKeys);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Failed to load categories.");
    }
  }

  useEffect(() => {
    loadAttendees().catch(() => undefined);
    loadFields().catch(() => undefined);
    loadUsers().catch(() => undefined);
    loadCategories().catch(() => undefined);
  }, []);

  async function upload(path: string) {
    if (!file) return;
    setMessage("");
    try {
      const data = new FormData();
      data.append("file", file);
      const response = await api<any>(path, { method: "POST", body: data });
      setMessage(`${response.acceptedRows ?? response.batch?.accepted_rows ?? 0} rows accepted.`);
      await loadAttendees();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Upload failed.");
    }
  }

  function startNewField() {
    setEditingFieldId(null);
    setFieldForm({ fieldKey: "", label: "", fieldType: "text", required: false, options: "", sortOrder: fields.length + 1, active: true, showInList: false });
  }

  function editField(field: FormField) {
    setEditingFieldId(field.id);
    setFieldForm({
      fieldKey: field.fieldKey,
      label: field.label,
      fieldType: field.fieldType,
      required: field.required,
      options: field.options.join(", "),
      sortOrder: field.sortOrder,
      active: field.active,
      showInList: field.showInList || false
    });
    setTab("form");
  }

  async function saveField(event: FormEvent) {
    event.preventDefault();
    setMessage("");
    try {
      const payload = {
        ...fieldForm,
        options: fieldForm.options.split(",").map((option) => option.trim()).filter(Boolean),
        sortOrder: Number(fieldForm.sortOrder)
      };
      await api(editingFieldId ? `/form-fields/${editingFieldId}` : "/form-fields", {
        method: editingFieldId ? "PUT" : "POST",
        body: JSON.stringify(payload)
      });
      setMessage(editingFieldId ? "Registration field updated." : "Registration field added.");
      startNewField();
      await loadFields();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Failed to save field.");
    }
  }

  async function deleteField(field: FormField) {
    const ok = window.confirm(`Delete "${field.label}" from the registration form? Existing attendee metadata will remain stored.`);
    if (!ok) return;
    setMessage("");
    try {
      await api(`/form-fields/${field.id}`, { method: "DELETE" });
      setMessage("Registration field deleted.");
      await loadFields();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Delete failed.");
    }
  }

  async function generateBatch() {
    setMessage("");
    try {
      const response = await api<any>("/qr/batches", { method: "POST", body: JSON.stringify({ name: `Event batch ${new Date().toLocaleString()}` }) });
      setMessage(`Generated ${response.batch.generatedCount} QR codes.`);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Generation failed.");
    }
  }

  async function sendBatch() {
    setMessage("");
    try {
      const response = await api<any>("/qr/send", { method: "POST", body: JSON.stringify({ mode: "unsent" }) });
      setMessage(`Attempted ${response.attempted} emails.`);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Sending failed.");
    }
  }

  async function exportCsv() {
    setMessage("");
    try {
      const session = getSession();
      const response = await fetch(`${API_URL}/qr/export.csv`, {
        headers: session ? { authorization: `Bearer ${session.token}` } : undefined
      });
      if (!response.ok) {
        setMessage("Export failed.");
        return;
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "qr-export.csv";
      link.click();
      URL.revokeObjectURL(url);
      setMessage("Export downloaded.");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Export failed.");
    }
  }

  async function createRule(event: FormEvent) {
    event.preventDefault();
    setMessage("");
    try {
      await api("/rules", {
        method: "POST",
        body: JSON.stringify({
          name: ruleForm.name,
          station: ruleForm.station,
          startsAt: ruleForm.startsAt ? new Date(ruleForm.startsAt).toISOString() : undefined,
          endsAt: ruleForm.endsAt ? new Date(ruleForm.endsAt).toISOString() : undefined,
          eligibility: {},
          active: true
        })
      });
      setRuleForm({ name: "", station: "entry", startsAt: "", endsAt: "" });
      setMessage("Scan rule created.");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Failed to create rule.");
    }
  }

  async function createUser(event: FormEvent) {
    event.preventDefault();
    setMessage("");
    try {
      const payload = {
        name: userForm.name,
        email: userForm.email,
        password: userForm.password,
        role: userForm.role,
        active: userForm.active,
        stations: userForm.stations.split(",").map((station) => station.trim()).filter(Boolean),
        categoryId: userForm.categoryId || null
      };
      await api(editingUserId ? `/auth/users/${editingUserId}` : "/auth/users", {
        method: editingUserId ? "PUT" : "POST",
        body: JSON.stringify(payload)
      });
      setUserForm({ name: "", email: "", password: "", role: "volunteer", active: true, stations: "entry", categoryId: "" });
      setEditingUserId(null);
      setMessage(editingUserId ? "User updated." : "User created.");
      await loadUsers();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Failed to save user.");
    }
  }

  function editUser(user: UserRow) {
    setEditingUserId(user.id);
    setUserForm({
      name: user.name,
      email: user.email,
      password: "",
      role: user.role,
      active: user.active,
      stations: parseStations(user.stations).join(","),
      categoryId: user.categoryId ?? ""
    });
  }

  async function deleteUser(user: UserRow) {
    const ok = window.confirm(`Delete ${user.name}? This removes their login and station scopes.`);
    if (!ok) return;
    setMessage("");
    try {
      await api(`/auth/users/${user.id}`, { method: "DELETE" });
      setMessage("User deleted.");
      await loadUsers();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Failed to delete user.");
    }
  }

  function toggleScope(scope: Station) {
    const selected = new Set(userForm.stations.split(",").map((value) => value.trim()).filter(Boolean));
    if (selected.has(scope)) selected.delete(scope);
    else selected.add(scope);
    setUserForm({ ...userForm, stations: Array.from(selected).join(",") });
  }

  function cancelUserEdit() {
    setEditingUserId(null);
    setUserForm({ name: "", email: "", password: "", role: "volunteer", active: true, stations: "entry", categoryId: "" });
  }

  async function saveCategory(event: FormEvent) {
    event.preventDefault();
    setMessage("");
    try {
      const payload = {
        name: categoryForm.name,
        description: categoryForm.description,
        color: categoryForm.color,
        active: categoryForm.active,
        stationPermissions: categoryForm.stationPermissions.split(",").map((station) => station.trim()).filter(Boolean),
        capabilities: categoryForm.capabilities
      };
      await api(editingCategoryId ? `/categories/${editingCategoryId}` : "/categories", {
        method: editingCategoryId ? "PUT" : "POST",
        body: JSON.stringify(payload)
      });
      setCategoryForm({ name: "", description: "", color: "#6366f1", active: true, stationPermissions: "", capabilities: {} });
      setEditingCategoryId(null);
      setMessage(editingCategoryId ? "Category updated." : "Category created.");
      await loadCategories();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Failed to save category.");
    }
  }

  function editCategory(category: UserCategory) {
    setEditingCategoryId(category.id);
    setCategoryForm({
      name: category.name,
      description: category.description,
      color: category.color,
      active: category.active,
      stationPermissions: parseStations(category.stationPermissions).join(","),
      capabilities: category.capabilities
    });
  }

  async function deleteCategory(category: UserCategory) {
    const ok = window.confirm(`Delete category ${category.name}? Users in this category will lose these permissions.`);
    if (!ok) return;
    setMessage("");
    try {
      await api(`/categories/${category.id}`, { method: "DELETE" });
      setMessage("Category deleted.");
      await loadCategories();
      await loadUsers(); // Refresh users to clear their category_id
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Failed to delete category.");
    }
  }

  function cancelCategoryEdit() {
    setEditingCategoryId(null);
    setCategoryForm({ name: "", description: "", color: "#6366f1", active: true, stationPermissions: "", capabilities: {} });
  }

  function toggleCategoryScope(scope: Station) {
    const selected = new Set(categoryForm.stationPermissions.split(",").map((value) => value.trim()).filter(Boolean));
    if (selected.has(scope)) selected.delete(scope);
    else selected.add(scope);
    setCategoryForm({ ...categoryForm, stationPermissions: Array.from(selected).join(",") });
  }

  function toggleCategoryCapability(cap: string) {
    setCategoryForm(prev => ({
      ...prev,
      capabilities: {
        ...prev.capabilities,
        [cap]: !prev.capabilities[cap]
      }
    }));
  }

  const parseStations = (stations: any): string[] => {
    if (Array.isArray(stations)) return stations.length ? stations : ["admin"];
    if (typeof stations === "string") {
      const cleaned = stations.replace(/[{}]/g, "");
      return cleaned ? cleaned.split(",") : ["admin"];
    }
    return ["admin"];
  };

  return (
    <section className="admin-workspace">
      <div className="section-title">
        <div>
          <p className="eyebrow">Admin desk</p>
          <h2>Manage registration operations</h2>
        </div>
      </div>
      {message && <p className="notice">{message}</p>}
      <nav className="admin-tabs">
        {[
          ["registrations", "Registrations"],
          ["form", "Form builder"],
          ["qr", "QR delivery"],
          ["rules", "Scan rules"],
          ["users", "Users"],
          ["verification", "Verification Queue"]
        ].map(([id, label]) => (
          <button key={id} className={tab === id ? "active" : ""} onClick={() => setTab(id as AdminTab)}>{label}</button>
        ))}
      </nav>

      {tab === "registrations" && (
        <div className="admin-grid">
          <div className="panel">
            <h3>Excel import</h3>
            <input type="file" accept=".xlsx" onChange={(event) => setFile(event.target.files?.[0] ?? null)} />
            <div className="row">
              <button className="secondary" onClick={() => upload("/imports/preview")}><Upload size={16} /> Preview</button>
              <button onClick={() => upload("/imports/commit")}><Upload size={16} /> Commit</button>
            </div>
          </div>
          <div className="panel wide-panel">
            <OnSpotForm session={getSession()!} fields={fields} loadAttendees={loadAttendees} />
          </div>
          <div className="panel full-span">
            <h3>Recent registrations</h3>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Attendee</th>
                    <th>Phone</th>
                    <th>College</th>
                    <th>Department</th>
                    <th>Status</th>
                    <th>Custom fields</th>
                  </tr>
                </thead>
                <tbody>
                  {attendees.map((attendee, index) => {
                    const initials = attendee.name.substring(0, 1).toUpperCase();
                    const avatarColors = ["purple", "teal", ""];
                    const colorClass = avatarColors[index % 3];
                    return (
                      <tr key={attendee.id}>
                        <td>
                          <div className="avatar-container">
                            <div className={`avatar-circle ${colorClass}`}>{initials}</div>
                            <div className="attendee-info">
                              <strong>{attendee.name}</strong>
                              <span>{attendee.email}</span>
                            </div>
                          </div>
                        </td>
                        <td>{attendee.phone}</td>
                        <td>{attendee.college}</td>
                        <td>{attendee.department}</td>
                        <td><span className={`status-badge ${(attendee.metadata?.verificationStatus ?? "verified")}`}>{attendee.metadata?.verificationStatus ?? "verified"}</span></td>
                        <td><CustomFieldChips values={attendee.metadata?.customFields ?? {}} fields={fields} /></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {tab === "form" && (
        <div className="admin-grid">
          <form className="panel" onSubmit={saveField}>
            <div className="panel-header">
              <h3>{editingFieldId ? "Edit field" : "Add field"}</h3>
              {editingFieldId && <button type="button" className="icon-button" title="Cancel edit" onClick={startNewField}><X size={16} /></button>}
            </div>
            <label>Label<input value={fieldForm.label} onChange={(event) => setFieldForm({ ...fieldForm, label: event.target.value })} required /></label>
            <label>Field key<input value={fieldForm.fieldKey} onChange={(event) => setFieldForm({ ...fieldForm, fieldKey: event.target.value })} placeholder="workshop_track" required /></label>
            <label>Type
              <select value={fieldForm.fieldType} onChange={(event) => setFieldForm({ ...fieldForm, fieldType: event.target.value })}>
                <option value="text">Text</option>
                <option value="email">Email</option>
                <option value="phone">Phone</option>
                <option value="number">Number</option>
                <option value="select">Select</option>
                <option value="textarea">Textarea</option>
                <option value="checkbox">Checkbox</option>
              </select>
            </label>
            <label>Options<input value={fieldForm.options} onChange={(event) => setFieldForm({ ...fieldForm, options: event.target.value })} placeholder="Option A, Option B" /></label>
            <label>Sort order<input type="number" value={fieldForm.sortOrder} onChange={(event) => setFieldForm({ ...fieldForm, sortOrder: Number(event.target.value) })} /></label>
            <div className="check-row">
              <label><input type="checkbox" checked={fieldForm.required} onChange={(event) => setFieldForm({ ...fieldForm, required: event.target.checked })} /> Required</label>
              <label><input type="checkbox" checked={fieldForm.active} onChange={(event) => setFieldForm({ ...fieldForm, active: event.target.checked })} /> Active</label>
              <label><input type="checkbox" checked={fieldForm.showInList} onChange={(event) => setFieldForm({ ...fieldForm, showInList: event.target.checked })} /> Show in list</label>
            </div>
            <button type="submit">{editingFieldId ? <Save size={16} /> : <Plus size={16} />} {editingFieldId ? "Update field" : "Add field"}</button>
          </form>
          <div className="panel wide-panel">
            <h3>Registration form fields</h3>
            <div className="field-list">
              {fields.map((field) => (
                <article className={`field-item ${field.active ? "" : "inactive"}`} key={field.id}>
                  <div>
                    <strong>{field.label}</strong>
                    <span>{field.fieldKey} - {field.fieldType} - order {field.sortOrder} {field.showInList ? "(Shown in List)" : ""}</span>
                    {field.options.length > 0 && <small>{field.options.join(", ")}</small>}
                  </div>
                  <div className="row">
                    <button className="secondary" onClick={() => editField(field)}><Edit3 size={16} /> Edit</button>
                    <button className="danger" onClick={() => deleteField(field)}><Trash2 size={16} /> Delete</button>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </div>
      )}

      {tab === "qr" && (
        <div className="panel">
          <h3>QR batches</h3>
          <div className="row">
            <button onClick={generateBatch}><QrCode size={16} /> Generate</button>
            <button onClick={sendBatch}><Send size={16} /> Send unsent</button>
            <button className="secondary" onClick={exportCsv}><Download size={16} /> Export CSV</button>
          </div>
        </div>
      )}

      {tab === "rules" && (
        <form className="panel narrow-panel" onSubmit={createRule}>
          <h3>Scan rule</h3>
          <label>Name<input value={ruleForm.name} onChange={(event) => setRuleForm({ ...ruleForm, name: event.target.value })} required /></label>
          <label>Station
            <select value={ruleForm.station} onChange={(event) => setRuleForm({ ...ruleForm, station: event.target.value })}>
              <option value="entry">Entry</option>
              <option value="food">Food</option>
              <option value="kit">Kit</option>
              <option value="custom">Custom</option>
            </select>
          </label>
          <label>Starts<input type="datetime-local" value={ruleForm.startsAt} onChange={(event) => setRuleForm({ ...ruleForm, startsAt: event.target.value })} /></label>
          <label>Ends<input type="datetime-local" value={ruleForm.endsAt} onChange={(event) => setRuleForm({ ...ruleForm, endsAt: event.target.value })} /></label>
          <button type="submit">Create rule</button>
        </form>
      )}

      {tab === "users" && (
        <div className="stack">
          <div className="admin-tabs" style={{ alignSelf: "flex-start", marginBottom: "-8px" }}>
            <button className={userSubTab === "users" ? "active" : ""} onClick={() => setUserSubTab("users")}>Users</button>
            <button className={userSubTab === "categories" ? "active" : ""} onClick={() => setUserSubTab("categories")}>Categories (Roles)</button>
          </div>

          {userSubTab === "categories" && (
            <div className="admin-grid">
              <form className="panel" onSubmit={saveCategory}>
                <div className="panel-header">
                  <h3>{editingCategoryId ? "Edit category" : "Add category"}</h3>
                  {editingCategoryId && <button type="button" className="icon-button" title="Cancel edit" onClick={cancelCategoryEdit}><X size={16} /></button>}
                </div>
                <label>Name<input value={categoryForm.name} onChange={(event) => setCategoryForm({ ...categoryForm, name: event.target.value })} required placeholder="e.g. Stage Manager" /></label>
                <label>Description<input value={categoryForm.description} onChange={(event) => setCategoryForm({ ...categoryForm, description: event.target.value })} placeholder="Permissions for stage managers" /></label>
                <label>Color
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    {['#ef4444', '#f59e0b', '#10b981', '#3b82f6', '#6366f1', '#8b5cf6', '#ec4899', '#64748b'].map(c => (
                      <button type="button" key={c} onClick={() => setCategoryForm({ ...categoryForm, color: c })} style={{ width: '28px', height: '28px', minHeight: '0', padding: '0', background: c, borderRadius: '50%', border: categoryForm.color === c ? '2px solid #0f172a' : '2px solid transparent', boxShadow: 'none' }} />
                    ))}
                  </div>
                </label>
                <div>
                  <p className="field-caption">Station Scopes</p>
                  <div className="scope-grid">
                    {scopes.map((scope) => (
                      <button type="button" key={scope} className={categoryForm.stationPermissions.split(",").includes(scope) ? "scope-chip active" : "scope-chip"} onClick={() => toggleCategoryScope(scope)}>
                        <ShieldCheck size={15} /> {scope}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="field-caption">Capabilities</p>
                  <div className="form-grid" style={{ gap: '10px' }}>
                    {capabilityKeys.map(cap => (
                      <label key={cap} className="checkbox-field" style={{ fontSize: '13px' }}>
                        <input type="checkbox" checked={categoryForm.capabilities[cap] || false} onChange={() => toggleCategoryCapability(cap)} /> 
                        {cap.replace("can_", "Can ").replace("_", " ")}
                      </label>
                    ))}
                  </div>
                </div>
                <div className="check-row">
                  <label><input type="checkbox" checked={categoryForm.active} onChange={(event) => setCategoryForm({ ...categoryForm, active: event.target.checked })} /> Active</label>
                </div>
                <button type="submit"><Save size={16} /> {editingCategoryId ? "Update category" : "Create category"}</button>
              </form>
              <div className="panel wide-panel">
                <h3>Available categories</h3>
                <div className="user-list">
                  {categories.map((category) => (
                    <article className={`user-item ${category.active ? "" : "inactive"}`} key={category.id}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ width: '12px', height: '12px', borderRadius: '50%', background: category.color }} />
                          <strong>{category.name}</strong>
                          <span className="status-badge transferred">{category.userCount} users</span>
                        </div>
                        <span style={{ marginTop: '4px' }}>{category.description || "No description"}</span>
                        <div className="scope-row" style={{ marginTop: '8px' }}>
                          {parseStations(category.stationPermissions).length > 0 ? parseStations(category.stationPermissions).map((scope) => <small key={scope}>{scope}</small>) : <small>No stations</small>}
                          {Object.entries(category.capabilities).filter(([, v]) => v).map(([k]) => <small key={k} style={{ background: '#fef3c7', color: '#d97706' }}>{k}</small>)}
                        </div>
                      </div>
                      <div className="row">
                        <button className="secondary" onClick={() => editCategory(category)}><Edit3 size={16} /> Edit</button>
                        <button className="danger" onClick={() => deleteCategory(category)}><Trash2 size={16} /> Delete</button>
                      </div>
                    </article>
                  ))}
                </div>
              </div>
            </div>
          )}

          {userSubTab === "users" && (
            <div className="admin-grid">
              <form className="panel" onSubmit={createUser}>
                <div className="panel-header">
                  <h3>{editingUserId ? "Edit user" : "Add user"}</h3>
                  {editingUserId && <button type="button" className="icon-button" title="Cancel edit" onClick={cancelUserEdit}><X size={16} /></button>}
                </div>
                <label>Name<input value={userForm.name} onChange={(event) => setUserForm({ ...userForm, name: event.target.value })} required /></label>
                <label>Email<input value={userForm.email} onChange={(event) => setUserForm({ ...userForm, email: event.target.value })} type="email" required /></label>
                <label>Password<input value={userForm.password} onChange={(event) => setUserForm({ ...userForm, password: event.target.value })} type="password" required={!editingUserId} placeholder={editingUserId ? "Leave blank to keep current password" : ""} /></label>
                <label>Role
                  <select value={userForm.role} onChange={(event) => setUserForm({ ...userForm, role: event.target.value })}>
                    <option value="volunteer">Volunteer</option>
                    <option value="admin">Admin</option>
                  </select>
                </label>
                {userForm.role === "volunteer" && (
                  <>
                    <label>Category (Role Template)
                      <select value={userForm.categoryId} onChange={(event) => setUserForm({ ...userForm, categoryId: event.target.value })}>
                        <option value="">-- No Category (Custom Permissions) --</option>
                        {categories.filter(c => c.active).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                    </label>
                    <div style={{ padding: '12px', background: '#f8fafc', borderRadius: '12px', border: '1px solid var(--color-border)' }}>
                      <p className="field-caption">Station Scopes (Overrides Category)</p>
                      <p className="muted" style={{ fontSize: '11px', marginBottom: '8px', marginTop: '0' }}>Leave empty to inherit from category.</p>
                      <div className="scope-grid">
                        {scopes.map((scope) => (
                          <button type="button" key={scope} className={userForm.stations.split(",").includes(scope) ? "scope-chip active" : "scope-chip"} onClick={() => toggleScope(scope)}>
                            <ShieldCheck size={15} /> {scope}
                          </button>
                        ))}
                      </div>
                    </div>
                  </>
                )}
                <div className="check-row">
                  <label><input type="checkbox" checked={userForm.active} onChange={(event) => setUserForm({ ...userForm, active: event.target.checked })} /> Active</label>
                </div>
                <button type="submit"><Save size={16} /> {editingUserId ? "Update user" : "Create user"}</button>
              </form>
              <div className="panel wide-panel">
                <h3>Available users</h3>
                <div className="user-list">
                  {users.map((user) => (
                    <article className={`user-item ${user.active ? "" : "inactive"}`} key={user.id}>
                      <div>
                        <strong>{user.name}</strong>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          {user.email} - {user.role} 
                          {user.categoryName && (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '10px', fontWeight: 700, padding: '2px 8px', borderRadius: '99px', background: user.categoryColor ? `${user.categoryColor}20` : '#f1f5f9', color: user.categoryColor || '#475569' }}>
                              <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: user.categoryColor || '#475569' }} />
                              {user.categoryName}
                            </span>
                          )}
                        </span>
                        <div className="scope-row">{parseStations(user.stations).map((scope) => <small key={scope}>{scope}</small>)}</div>
                      </div>
                      <div className="row">
                        <button className="secondary" onClick={() => editUser(user)}><Edit3 size={16} /> Edit</button>
                        <button className="danger" onClick={() => deleteUser(user)}><Trash2 size={16} /> Delete</button>
                      </div>
                    </article>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {tab === "verification" && (
        <VerificationQueue session={getSession()!} attendees={attendees} loadAttendees={loadAttendees} />
      )}
    </section>
  );
}

function DynamicField({ field, value, onChange }: { field: FormField; value: unknown; onChange: (value: unknown) => void }) {
  if (field.fieldType === "select") {
    return (
      <label>{field.label}
        <select value={String(value ?? "")} required={field.required} onChange={(event) => onChange(event.target.value)}>
          <option value="">Select</option>
          {field.options.map((option) => <option key={option} value={option}>{option}</option>)}
        </select>
      </label>
    );
  }

  if (field.fieldType === "textarea") {
    return <label>{field.label}<textarea value={String(value ?? "")} required={field.required} onChange={(event) => onChange(event.target.value)} /></label>;
  }

  if (field.fieldType === "checkbox") {
    return <label className="checkbox-field"><input type="checkbox" checked={Boolean(value)} onChange={(event) => onChange(event.target.checked)} /> {field.label}</label>;
  }

  const inputType = field.fieldType === "phone" ? "tel" : field.fieldType;
  return <label>{field.label}<input type={inputType} value={String(value ?? "")} required={field.required} onChange={(event) => onChange(event.target.value)} /></label>;
}

function CustomFieldChips({ values, fields }: { values: Record<string, unknown>; fields: FormField[] }) {
  const entries = Object.entries(values).filter(([, value]) => value !== undefined && value !== null && value !== "");
  if (entries.length === 0) {
    return <span className="muted">None</span>;
  }

  return (
    <div className="custom-chip-row">
      {entries.map(([key, value]) => {
        const field = fields.find((item) => item.fieldKey === key);
        return <span key={key}>{field?.label ?? key}: {String(value)}</span>;
      })}
    </div>
  );
}

// Reusable Dynamic OnSpotForm component
function OnSpotForm({
  session,
  fields,
  loadAttendees,
  onSaved,
  isPublic = false
}: {
  session?: Session;
  fields: FormField[];
  loadAttendees?: () => void;
  onSaved?: () => void;
  isPublic?: boolean;
}) {
  const [values, setValues] = useState<Record<string, any>>({});
  const [paymentProof, setPaymentProof] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const activeFields = useMemo(() => {
    // If no custom fields are seeded in the database, fallback to beautiful default event fields
    if (fields.length === 0) {
      return DEFAULT_FIELDS;
    }
    return fields.filter((f) => f.active);
  }, [fields]);

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPaymentProof(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setMessage("");
    setError("");

    const payload: Record<string, any> = {
      name: values.name || "",
      email: values.email || "",
      phone: values.phone || "",
      college: values.college || "",
      department: values.department || "",
      externalRef: values.externalRef || "",
      customFields: {},
      paymentProof
    };

    activeFields.forEach((field) => {
      const key = field.fieldKey;
      if (["name", "email", "phone", "college", "department", "externalRef"].includes(key)) {
        payload[key] = values[key];
      } else {
        payload.customFields[key] = values[key];
      }
    });

    try {
      const endpoint = isPublic ? "/attendees/public-register" : "/attendees";
      await api(endpoint, {
        method: "POST",
        body: JSON.stringify(payload)
      });
      setMessage(isPublic ? "Registration submitted. Staff will verify your payment shortly." : "Registration saved successfully.");
      setValues({});
      setPaymentProof(null);
      if (loadAttendees) loadAttendees();
      if (onSaved) onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed.");
    }
  }

  return (
    <form onSubmit={submit} className="stack">
      <div className="section-title" style={{ marginBottom: "12px" }}>
        <h3 style={{ fontSize: "20px", fontWeight: "800" }}>{isPublic ? "Register Attendee" : "On-Spot Registration"}</h3>
        {isPublic && <p className="eyebrow" style={{ margin: 0 }}>DISCOVER 2026 DISTRICT OPERATIONS</p>}
      </div>
      {message && <p className="notice">{message}</p>}
      {error && <p className="error">{error}</p>}
      <div className="form-grid">
        {activeFields.map((field) => (
          <DynamicField
            key={field.id}
            field={field}
            value={values[field.fieldKey]}
            onChange={(value) => setValues({ ...values, [field.fieldKey]: value })}
          />
        ))}
      </div>
      <div className="panel" style={{ marginTop: "10px" }}>
        <h4 style={{ margin: "0 0 8px", fontSize: "14px", fontWeight: "800" }}>Payment Proof Verification</h4>
        <input type="file" accept="image/*" required={isPublic} onChange={handleFileChange} />
        {paymentProof && (
          <div style={{ marginTop: "14px" }}>
            <p className="field-caption">Payment Preview:</p>
            <img src={paymentProof} alt="Payment Proof Preview" style={{ maxWidth: "100%", maxHeight: "160px", borderRadius: "10px" }} />
          </div>
        )}
      </div>
      <button type="submit" style={{ width: "100%", minHeight: "46px" }}><Save size={16} /> {isPublic ? "Submit Registration" : "Save Attendee"}</button>
    </form>
  );
}

// Public Register Component
function PublicRegister({ onBack }: { onBack: () => void }) {
  const [fields, setFields] = useState<FormField[]>([]);

  useEffect(() => {
    api<{ fields: FormField[] }>("/form-fields/public")
      .then((res) => setFields(res.fields))
      .catch(() => undefined);
  }, []);

  return (
    <main className="login-page">
      <div className="login-panel" style={{ maxWidth: "800px", width: "90%", textAlign: "left" }}>
        <button type="button" className="secondary" style={{ marginBottom: "20px" }} onClick={onBack}><X size={16} /> Back to Sign In</button>
        <OnSpotForm fields={fields} isPublic={true} />
      </div>
    </main>
  );
}

// Public Ticket Transfer Component
function PublicTransfer({ onBack }: { onBack: () => void }) {
  const [originalId, setOriginalId] = useState("");
  const [recipientValues, setRecipientValues] = useState<Record<string, any>>({});
  const [paymentProof, setPaymentProof] = useState<string | null>(null);
  const [fields, setFields] = useState<FormField[]>([]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const activeFields = useMemo(() => {
    if (fields.length === 0) {
      return DEFAULT_FIELDS;
    }
    return fields.filter((f) => f.active);
  }, [fields]);

  useEffect(() => {
    api<{ fields: FormField[] }>("/form-fields/public")
      .then((res) => setFields(res.fields))
      .catch(() => undefined);
  }, []);

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPaymentProof(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setMessage("");
    setError("");

    const recipientData: Record<string, any> = {
      name: recipientValues.name || "",
      email: recipientValues.email || "",
      phone: recipientValues.phone || "",
      college: recipientValues.college || "",
      department: recipientValues.department || "",
      externalRef: recipientValues.externalRef || "",
      customFields: {}
    };

    activeFields.forEach((field) => {
      const key = field.fieldKey;
      if (["name", "email", "phone", "college", "department", "externalRef"].includes(key)) {
        recipientData[key] = recipientValues[key];
      } else {
        recipientData.customFields[key] = recipientValues[key];
      }
    });

    try {
      await api("/attendees/public-transfer", {
        method: "POST",
        body: JSON.stringify({
          originalAttendeeId: originalId,
          recipient: recipientData,
          paymentProof
        })
      });
      setMessage("Transfer request submitted successfully. Staff will verify your request soon.");
      setOriginalId("");
      setRecipientValues({});
      setPaymentProof(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Transfer request failed.");
    }
  }

  return (
    <main className="login-page">
      <div className="login-panel" style={{ maxWidth: "800px", width: "90%", textAlign: "left" }}>
        <button type="button" className="secondary" style={{ marginBottom: "20px" }} onClick={onBack}><X size={16} /> Back to Sign In</button>
        <form onSubmit={submit} className="stack">
          <div className="section-title">
            <h3 style={{ fontSize: "20px", fontWeight: "800" }}>Self-Applied Ticket Transfer</h3>
            <p className="eyebrow" style={{ margin: 0 }}>DISCOVER 2026 DISTRICT OPERATIONS</p>
          </div>
          {message && <p className="notice">{message}</p>}
          {error && <p className="error">{error}</p>}
          
          <label>Original Ticket ID (UUID)<input value={originalId} onChange={(event) => setOriginalId(event.target.value)} placeholder="00000000-0000-0000-0000-000000000000" required /></label>
          
          <h4 style={{ margin: "14px 0 0", fontSize: "14px", fontWeight: "800" }}>Recipient Registration Details</h4>
          <div className="form-grid">
            {activeFields.map((field) => (
              <DynamicField
                key={field.id}
                field={field}
                value={recipientValues[field.fieldKey]}
                onChange={(value) => setRecipientValues({ ...recipientValues, [field.fieldKey]: value })}
              />
            ))}
          </div>

          <div className="panel" style={{ marginTop: "10px" }}>
            <h4 style={{ margin: "0 0 8px", fontSize: "14px", fontWeight: "800" }}>Transfer Fee / Payment Proof Upload</h4>
            <input type="file" accept="image/*" required onChange={handleFileChange} />
            {paymentProof && (
              <div style={{ marginTop: "14px" }}>
                <p className="field-caption">Payment Preview:</p>
                <img src={paymentProof} alt="Payment Proof Preview" style={{ maxWidth: "100%", maxHeight: "160px", borderRadius: "10px" }} />
              </div>
            )}
          </div>
          <button type="submit" style={{ width: "100%", minHeight: "46px" }}><Send size={16} /> Submit Transfer Request</button>
        </form>
      </div>
    </main>
  );
}

// Verification Queue Tab Component
function VerificationQueue({
  session,
  attendees,
  loadAttendees
}: {
  session: Session;
  attendees: any[];
  loadAttendees: () => void;
}) {
  const [selectedAttendee, setSelectedAttendee] = useState<any | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const pendingAttendees = useMemo(() => {
    return attendees.filter((a) => a.metadata?.verificationStatus === "pending");
  }, [attendees]);

  async function handleVerify(id: string, action: "approve" | "reject") {
    setMessage("");
    setError("");
    try {
      await api(`/attendees/${id}/verify`, {
        method: "POST",
        body: JSON.stringify({ action })
      });
      setMessage(`Ticket ${action === "approve" ? "approved" : "rejected"} successfully.`);
      setSelectedAttendee(null);
      loadAttendees();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Verification action failed.");
    }
  }

  return (
    <div className="panel full-span">
      <h3>Staff Verification Queue</h3>
      {message && <p className="notice">{message}</p>}
      {error && <p className="error">{error}</p>}

      {pendingAttendees.length === 0 ? (
        <p className="empty-state">No pending registrations or transfers in the queue.</p>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Type</th>
                <th>Attendee Name</th>
                <th>Email</th>
                <th>College</th>
                <th>Original Ticket ID (for Transfers)</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {pendingAttendees.map((attendee) => {
                const isTransfer = !!attendee.metadata?.transferredFrom;
                return (
                  <tr key={attendee.id}>
                    <td>
                      <span className={`status-badge ${isTransfer ? "pending" : "verified"}`}>
                        {isTransfer ? "Ticket Transfer" : "New Registration"}
                      </span>
                    </td>
                    <td>{attendee.name}</td>
                    <td>{attendee.email}</td>
                    <td>{attendee.college ?? "None"}</td>
                    <td><small>{attendee.metadata?.transferredFrom ?? "N/A"}</small></td>
                    <td>
                      <div className="row">
                        <button onClick={() => setSelectedAttendee(attendee)}>Review Details</button>
                        <button className="secondary" onClick={() => handleVerify(attendee.id, "approve")}>Approve</button>
                        <button className="danger" onClick={() => handleVerify(attendee.id, "reject")}>Reject</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {selectedAttendee && (
        <div className="modal-backdrop" style={{ display: "flex" }}>
          <div className="login-panel" style={{ maxWidth: "680px", width: "90%", maxHeight: "90vh", overflowY: "auto", textAlign: "left" }}>
            <div className="panel-header" style={{ marginBottom: "20px" }}>
              <h3>Review Pending Submission</h3>
              <button className="icon-button" onClick={() => setSelectedAttendee(null)}><X size={18} /></button>
            </div>
            
            <p><strong>Type:</strong> {selectedAttendee.metadata?.transferredFrom ? "Ticket Transfer" : "New Registration"}</p>
            <p><strong>Name:</strong> {selectedAttendee.name}</p>
            <p><strong>Email:</strong> {selectedAttendee.email}</p>
            <p><strong>Phone:</strong> {selectedAttendee.phone ?? "None"}</p>
            <p><strong>College:</strong> {selectedAttendee.college ?? "None"}</p>
            <p><strong>Department:</strong> {selectedAttendee.department ?? "None"}</p>
            
            {selectedAttendee.metadata?.transferredFrom && (
              <div className="panel" style={{ margin: "14px 0" }}>
                <h4>Original Ticket Holder Info</h4>
                <p><strong>Original UUID:</strong> {selectedAttendee.metadata.transferredFrom}</p>
              </div>
            )}

            {selectedAttendee.metadata?.paymentProof ? (
              <div className="panel" style={{ textAlign: "center", margin: "14px 0" }}>
                <h4 style={{ textAlign: "left" }}>Submitted Payment Proof</h4>
                <img src={selectedAttendee.metadata.paymentProof} alt="Payment Proof" style={{ maxWidth: "100%", maxHeight: "350px", borderRadius: "10px" }} />
              </div>
            ) : (
              <p className="muted" style={{ margin: "14px 0" }}>No payment proof uploaded.</p>
            )}

            <div className="row" style={{ marginTop: "24px", justifyContent: "flex-end" }}>
              <button className="danger" onClick={() => handleVerify(selectedAttendee.id, "reject")}>Reject Submission</button>
              <button onClick={() => handleVerify(selectedAttendee.id, "approve")}><ShieldCheck size={16} /> Approve & Activate QR</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Volunteer Workstation Component containing sub-views
function VolunteerWorkstation({ session }: { session: Session }) {
  const [tab, setTab] = useState<"scanner" | "database" | "verification" | "onspot">("scanner");
  const [fields, setFields] = useState<FormField[]>([]);
  const [attendees, setAttendees] = useState<any[]>([]);
  const [message, setMessage] = useState("");

  async function loadFields() {
    try {
      const response = await api<{ fields: FormField[] }>("/form-fields");
      setFields(response.fields);
    } catch (err) {
      setMessage("Failed to load form fields.");
    }
  }

  async function loadAttendees() {
    try {
      const response = await api<{ attendees: any[] }>("/attendees");
      setAttendees(response.attendees);
    } catch (err) {
      setMessage("Failed to load attendees.");
    }
  }

  useEffect(() => {
    loadFields().catch(() => undefined);
    loadAttendees().catch(() => undefined);
  }, []);

  return (
    <section className="stack">
      {message && <p className="notice">{message}</p>}
      <nav className="admin-tabs">
        <button className={tab === "scanner" ? "active" : ""} onClick={() => setTab("scanner")}><QrCode size={16} /> Scan QR Codes</button>
        <button className={tab === "database" ? "active" : ""} onClick={() => setTab("database")}><Users size={16} /> Attendee Database</button>
        <button className={tab === "verification" ? "active" : ""} onClick={() => setTab("verification")}><ShieldCheck size={16} /> Verification Queue</button>
        <button className={tab === "onspot" ? "active" : ""} onClick={() => setTab("onspot")}><Plus size={16} /> On-Spot Registration</button>
      </nav>

      {tab === "scanner" && <Scanner session={session} />}
      {tab === "database" && <AttendeeDatabase session={session} fields={fields} attendees={attendees} loadAttendees={loadAttendees} />}
      {tab === "verification" && <VerificationQueue session={session} attendees={attendees} loadAttendees={loadAttendees} />}
      {tab === "onspot" && <OnSpotForm session={session} fields={fields} loadAttendees={loadAttendees} onSaved={() => setTab("database")} />}
    </section>
  );
}

// Attendee Database component (Table, Sortable, Searchable, Editable, Exportable)
function AttendeeDatabase({
  session,
  fields,
  attendees,
  loadAttendees
}: {
  session: Session;
  fields: FormField[];
  attendees: any[];
  loadAttendees: () => void;
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [sortKey, setSortKey] = useState<string>("");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const [editingAttendee, setEditingAttendee] = useState<any | null>(null);
  const [editValues, setEditValues] = useState<Record<string, any>>({});
  const [recipientValues, setRecipientValues] = useState<Record<string, any>>({});
  const [paymentProof, setPaymentProof] = useState<string | null>(null);
  
  const [isTransferMode, setIsTransferMode] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const listColumns = useMemo(() => {
    if (fields.length === 0) {
      return DEFAULT_FIELDS.filter((f) => f.showInList);
    }
    return fields.filter((f) => f.active && f.showInList);
  }, [fields]);

  const activeFields = useMemo(() => {
    if (fields.length === 0) {
      return DEFAULT_FIELDS;
    }
    return fields.filter((f) => f.active);
  }, [fields]);

  function handleSort(key: string) {
    if (sortKey === key) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortOrder("asc");
    }
  }

  const sortedAttendees = useMemo(() => {
    if (!sortKey) return attendees;
    return [...attendees].sort((a, b) => {
      let valA = a[sortKey] ?? a.metadata?.customFields?.[sortKey] ?? "";
      let valB = b[sortKey] ?? b.metadata?.customFields?.[sortKey] ?? "";
      if (typeof valA === "string") valA = valA.toLowerCase();
      if (typeof valB === "string") valB = valB.toLowerCase();
      if (valA < valB) return sortOrder === "asc" ? -1 : 1;
      if (valA > valB) return sortOrder === "asc" ? 1 : -1;
      return 0;
    });
  }, [attendees, sortKey, sortOrder]);

  const filteredAttendees = useMemo(() => {
    return sortedAttendees.filter((item) => {
      const matchText = (item.name + " " + item.email + " " + (item.phone ?? "") + " " + (item.college ?? "")).toLowerCase();
      return matchText.includes(searchQuery.toLowerCase());
    });
  }, [sortedAttendees, searchQuery]);

  function handleEditClick(attendee: any) {
    setEditingAttendee(attendee);
    setIsTransferMode(false);
    setPaymentProof(null);
    const initialValues: Record<string, any> = {
      name: attendee.name,
      email: attendee.email,
      phone: attendee.phone,
      college: attendee.college,
      department: attendee.department,
      externalRef: attendee.externalRef,
      ...attendee.metadata?.customFields
    };
    setEditValues(initialValues);
  }

  async function saveEdit(event: FormEvent) {
    event.preventDefault();
    setMessage("");
    setError("");

    const payload: Record<string, any> = {
      name: editValues.name || "",
      email: editValues.email || "",
      phone: editValues.phone || "",
      college: editValues.college || "",
      department: editValues.department || "",
      externalRef: editValues.externalRef || "",
      customFields: {}
    };

    activeFields.forEach((field) => {
      const key = field.fieldKey;
      if (["name", "email", "phone", "college", "department", "externalRef"].includes(key)) {
        payload[key] = editValues[key];
      } else {
        payload.customFields[key] = editValues[key];
      }
    });

    try {
      await api(`/attendees/${editingAttendee.id}`, {
        method: "PUT",
        body: JSON.stringify(payload)
      });
      setMessage("Attendee details updated successfully.");
      setEditingAttendee(null);
      loadAttendees();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update attendee.");
    }
  }

  function handleTransferFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPaymentProof(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  }

  async function executeTransfer(event: FormEvent) {
    event.preventDefault();
    setMessage("");
    setError("");

    const recipientData: Record<string, any> = {
      name: recipientValues.name || "",
      email: recipientValues.email || "",
      phone: recipientValues.phone || "",
      college: recipientValues.college || "",
      department: recipientValues.department || "",
      externalRef: recipientValues.externalRef || "",
      customFields: {}
    };

    activeFields.forEach((field) => {
      const key = field.fieldKey;
      if (["name", "email", "phone", "college", "department", "externalRef"].includes(key)) {
        recipientData[key] = recipientValues[key];
      } else {
        recipientData.customFields[key] = recipientValues[key];
      }
    });

    try {
      await api("/attendees/public-transfer", {
        method: "POST",
        body: JSON.stringify({
          originalAttendeeId: editingAttendee.id,
          recipient: recipientData,
          paymentProof
        })
      });
      setMessage("Transfer request submitted to the staff verification queue.");
      setEditingAttendee(null);
      setRecipientValues({});
      setPaymentProof(null);
      loadAttendees();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Transfer failed.");
    }
  }

  function exportToCsv() {
    const headers = listColumns.map((col) => col.label).concat(["Verification Status"]);
    const csvRows = filteredAttendees.map((item) => {
      return listColumns
        .map((col) => item[col.fieldKey] ?? item.metadata?.customFields?.[col.fieldKey] ?? "")
        .concat([item.metadata?.verificationStatus ?? "verified"]);
    });

    const csvContent = "data:text/csv;charset=utf-8," 
      + [headers.join(",")].concat(csvRows.map((e) => e.map((val) => `"${String(val).replaceAll('"', '""')}"`).join(","))).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "attendee-records.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setMessage("CSV export downloaded successfully.");
  }

  return (
    <div className="panel full-span">
      <div className="section-title">
        <h3>Attendee Directory</h3>
        <div className="row">
          <div className="search-box-wrap">
            <input
              type="text"
              placeholder="Find by Name, Email, or Booking ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <button className="secondary" onClick={exportToCsv}><Download size={15} /> Export CSV</button>
        </div>
      </div>

      {message && <p className="notice">{message}</p>}
      {error && <p className="error">{error}</p>}

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Attendee</th>
              {listColumns.filter(col => !["name", "email"].includes(col.fieldKey)).map((col) => (
                <th key={col.id} onClick={() => handleSort(col.fieldKey)} style={{ cursor: "pointer" }}>
                  {col.label} {sortKey === col.fieldKey ? (sortOrder === "asc" ? "▲" : "▼") : ""}
                </th>
              ))}
              <th>Verification Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredAttendees.map((attendee, index) => {
              const initials = attendee.name.substring(0, 1).toUpperCase();
              const avatarColors = ["purple", "teal", ""];
              const colorClass = avatarColors[index % 3];
              return (
                <tr key={attendee.id}>
                  <td>
                    <div className="avatar-container">
                      <div className={`avatar-circle ${colorClass}`}>{initials}</div>
                      <div className="attendee-info">
                        <strong>{attendee.name}</strong>
                        <span>{attendee.email}</span>
                      </div>
                    </div>
                  </td>
                  {listColumns.filter(col => !["name", "email"].includes(col.fieldKey)).map((col) => (
                    <td key={col.id}>{String(attendee[col.fieldKey] ?? attendee.metadata?.customFields?.[col.fieldKey] ?? "")}</td>
                  ))}
                  <td>
                    <span className={`status-badge ${(attendee.metadata?.verificationStatus ?? "verified")}`}>
                      {attendee.metadata?.verificationStatus ?? "verified"}
                    </span>
                  </td>
                  <td>
                    <div className="row">
                      <button className="secondary" onClick={() => handleEditClick(attendee)}><Edit3 size={14} /> Edit</button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* High-Fidelity Edit Details and Ticket Transfer Wizard Modal Backdrop (screenshot 3) */}
      {editingAttendee && (
        <div className="modal-backdrop">
          <div className="modal-container">
            <div className="modal-left">
              <div className="modal-title-area">
                <div>
                  <h3 style={{ fontSize: "20px", fontWeight: "800" }}>Register Attendee</h3>
                  <p className="eyebrow" style={{ margin: "4px 0 0 0" }}>DISCOVER 2026 DISTRICT OPERATIONS</p>
                </div>
                <button type="button" className="icon-button" onClick={() => setEditingAttendee(null)}><X size={18} /></button>
              </div>
              
              <form onSubmit={saveEdit} className="stack">
                <div className="form-grid">
                  {activeFields.map((field) => (
                    <DynamicField
                      key={field.id}
                      field={field}
                      value={editValues[field.fieldKey]}
                      onChange={(value) => setEditValues({ ...editValues, [field.fieldKey]: value })}
                    />
                  ))}
                </div>
                <button type="submit" style={{ marginTop: "14px", width: "100%" }}><Save size={15} /> Save Changes</button>
              </form>
            </div>
            
            <div className="modal-right">
              <div className="transfer-logic-header">
                <div className="transfer-icon-box"><RefreshCcw size={18} /></div>
                <h4>TRANSFER LOGIC</h4>
              </div>

              <div className={`transfer-card-box ${isTransferMode ? "active" : ""}`}>
                <label className="checkbox-field" style={{ textTransform: "none", fontSize: "14px" }}>
                  <input type="checkbox" checked={isTransferMode} onChange={(e) => setIsTransferMode(e.target.checked)} />
                  <strong>TRANSFER TICKET?</strong>
                </label>
              </div>

              {isTransferMode && (
                <form onSubmit={executeTransfer} className="stack" style={{ marginTop: "10px" }}>
                  <h4 style={{ margin: "0", fontSize: "14px", fontWeight: "800" }}>Recipient Dynamic Information</h4>
                  <div className="form-grid" style={{ gridTemplateColumns: "1fr", gap: "14px" }}>
                    {activeFields.map((field) => (
                      <DynamicField
                        key={field.id}
                        field={field}
                        value={recipientValues[field.fieldKey]}
                        onChange={(value) => setRecipientValues({ ...recipientValues, [field.fieldKey]: value })}
                      />
                    ))}
                  </div>

                  <div className="panel" style={{ background: "white", padding: "16px", marginTop: "10px" }}>
                    <h4 style={{ margin: "0 0 10px 0", fontSize: "13px" }}>Transfer Payment Proof</h4>
                    <input type="file" accept="image/*" required onChange={handleTransferFile} />
                    {paymentProof && (
                      <div style={{ marginTop: "10px" }}>
                        <img src={paymentProof} alt="Payment Proof" style={{ maxWidth: "100px", maxHeight: "80px", borderRadius: "6px" }} />
                      </div>
                    )}
                  </div>
                  
                  <button type="submit" style={{ background: "#db2777", width: "100%" }}><Send size={15} /> Confirm Ticket Transfer</button>
                </form>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Scanner({ session }: { session: Session }) {
  const [station, setStation] = useState<Station>("entry");
  const [payload, setPayload] = useState("");
  const [queueCount, setQueueCount] = useState(listQueuedScans().length);
  const [result, setResult] = useState("");
  const [decoded, setDecoded] = useState<Record<string, unknown> | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const scannerRef = useRef<Html5Qrcode | null>(null);

  async function startCamera() {
    setCameraError("");
    try {
      if (!scannerRef.current) {
        scannerRef.current = new Html5Qrcode("qr-reader");
      }
      await scannerRef.current.start(
        { facingMode: "environment" },
        { fps: 8, qrbox: { width: 260, height: 260 } },
        (text) => {
          setPayload(text);
          setResult("QR captured. Review and record the scan.");
        },
        () => undefined
      );
      setCameraActive(true);
    } catch (error) {
      setCameraError(error instanceof Error ? error.message : "Camera could not start.");
      setCameraActive(false);
    }
  }

  async function stopCamera() {
    if (!scannerRef.current) return;
    try {
      await scannerRef.current.stop();
      await scannerRef.current.clear();
    } catch {
      // The scanner may already be stopped by the browser.
    }
    scannerRef.current = null;
    setCameraActive(false);
  }

  useEffect(() => {
    return () => {
      stopCamera().catch(() => undefined);
    };
  }, []);

  async function recordScan() {
    if (!hasEncryptedQrShape(payload)) {
      setResult("Denied: QR payload is not in the encrypted Reg Desk format.");
      return;
    }

    try {
      setDecoded(await decryptQrPayload(payload, session.qrDecryptKey));
    } catch (error) {
      setResult(error instanceof Error ? error.message : "Unable to decrypt QR payload offline.");
      return;
    }

    const scan = {
      localScanId: crypto.randomUUID(),
      encryptedPayload: payload,
      payloadHash: await hashPayload(payload),
      station,
      scannedAt: new Date().toISOString(),
      offlineCreated: !navigator.onLine,
      deviceId: deviceId()
    };

    try {
      const response = await api<{ results: Array<{ status: string; reason: string }> }>("/scans/sync", {
        method: "POST",
        body: JSON.stringify({ scans: [scan] })
      });
      setResult(`${response.results[0].status}: ${response.results[0].reason}`);
    } catch {
      enqueueScan(scan);
      setQueueCount(listQueuedScans().length);
      setResult("Pending sync: scan saved locally.");
    }
    setPayload("");
  }

  async function syncQueue() {
    const results = await flushScans();
    setQueueCount(listQueuedScans().length);
    setResult(results.length ? `Synced ${results.length} scans.` : "No queued scans.");
  }

  return (
    <section className="stack scanner">
      <div className="section-title">
        <h2>Volunteer scanner</h2>
        <button className="secondary" onClick={syncQueue}><RefreshCcw size={16} /> Sync queue ({queueCount})</button>
      </div>
      <div className="scanner-grid">
        <div className="panel scanner-panel">
          <div className="panel-header">
            <h3>Camera</h3>
            <button className={cameraActive ? "secondary" : ""} onClick={cameraActive ? stopCamera : startCamera}>
              {cameraActive ? <CameraOff size={16} /> : <Camera size={16} />} {cameraActive ? "Stop camera" : "Start camera"}
            </button>
          </div>
          <div id="qr-reader" className={cameraActive ? "qr-reader active" : "qr-reader"}>
            {!cameraActive && <div className="camera-placeholder"><QrCode size={42} /><span>Camera is off</span></div>}
          </div>
          {cameraError && <p className="error">{cameraError}</p>}
        </div>
        <div className="panel scan-controls">
          <label>Station
            <select value={station} onChange={(event) => setStation(event.target.value as Station)}>
              <option value="entry">Entry</option>
              <option value="food">Food</option>
              <option value="kit">Kit</option>
              <option value="custom">Custom</option>
            </select>
          </label>
          <label>Encrypted QR payload
            <textarea value={payload} onChange={(event) => setPayload(event.target.value)} placeholder="Captured QR payload appears here. Paste manually if camera fails." />
          </label>
          <button onClick={recordScan}><QrCode size={16} /> Record scan</button>
          {result && <p className="notice">{result}</p>}
          {decoded && <pre className="decoded">{JSON.stringify(decoded, null, 2)}</pre>}
        </div>
      </div>
    </section>
  );
}
