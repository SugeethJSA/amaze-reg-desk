import { Activity, Camera, CameraOff, Download, Edit3, LogOut, Plus, QrCode, RefreshCcw, Save, Send, ShieldCheck, Trash2, Upload, Users, X } from "lucide-react";
import { Html5Qrcode } from "html5-qrcode";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { API_URL, api, getSession, setSession, type Session } from "./api";
import { decryptQrPayload, hasEncryptedQrShape, hashPayload } from "./crypto";
import { deviceId, enqueueScan, flushScans, listQueuedScans } from "./offlineQueue";

type View = "dashboard" | "admin" | "scanner";
type Station = "entry" | "food" | "kit" | "custom";
type AdminTab = "registrations" | "form" | "qr" | "rules" | "users";
type UserRow = {
  id: string;
  name: string;
  email: string;
  role: "admin" | "volunteer";
  active: boolean;
  stations: Station[];
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
};

export function App() {
  const [session, setSessionState] = useState<Session | null>(getSession());
  const [view, setView] = useState<View>("dashboard");

  if (!session) {
    return <Login onLogin={(next) => {
      setSession(next);
      setSessionState(next);
    }} />;
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
          <button className={view === "dashboard" ? "active" : ""} onClick={() => setView("dashboard")}><Activity size={18} /> Dashboard</button>
          <button className={view === "admin" ? "active" : ""} onClick={() => setView("admin")}><Users size={18} /> Admin</button>
          <button className={view === "scanner" ? "active" : ""} onClick={() => setView("scanner")}><QrCode size={18} /> Scanner</button>
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
            <h2>{view === "dashboard" ? "Live control center" : view === "admin" ? "Registration management" : "Mobile scan station"}</h2>
          </div>
        </header>
        {view === "dashboard" && <Dashboard />}
        {view === "admin" && <Admin />}
        {view === "scanner" && <Scanner session={session} />}
      </main>
    </div>
  );
}

function Login({ onLogin }: { onLogin: (session: Session) => void }) {
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
        <h1>Amaze Reg Desk</h1>
        <label>Email<input value={email} onChange={(event) => setEmail(event.target.value)} type="email" required /></label>
        <label>Password<input value={password} onChange={(event) => setPassword(event.target.value)} type="password" required /></label>
        {error && <p className="error">{error}</p>}
        <button type="submit">Sign in</button>
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
        { label: "Food remaining estimate", value: 100 - percent(foodClaimed, attendeeTotal), detail: `${Math.max(0, attendeeTotal - foodClaimed)} estimated remaining`, tone: "info" as const },
        { label: "Kit remaining estimate", value: 100 - percent(kitClaimed, attendeeTotal), detail: `${Math.max(0, attendeeTotal - kitClaimed)} estimated remaining`, tone: "info" as const }
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
              : <p className="empty-state">No select or checkbox custom fields have responses yet.</p>}
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
  const [form, setForm] = useState({ name: "", email: "", phone: "", college: "", department: "" });
  const [customValues, setCustomValues] = useState<Record<string, unknown>>({});
  const [fields, setFields] = useState<FormField[]>([]);
  const [editingFieldId, setEditingFieldId] = useState<string | null>(null);
  const [fieldForm, setFieldForm] = useState({
    fieldKey: "",
    label: "",
    fieldType: "text",
    required: false,
    options: "",
    sortOrder: 0,
    active: true
  });
  const [ruleForm, setRuleForm] = useState({ name: "", station: "entry", startsAt: "", endsAt: "" });
  const [users, setUsers] = useState<UserRow[]>([]);
  const [scopes, setScopes] = useState<Station[]>(["entry", "food", "kit", "custom"]);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [userForm, setUserForm] = useState({ name: "", email: "", password: "", role: "volunteer", active: true, stations: "entry" });

  async function loadAttendees() {
    const response = await api<{ attendees: any[] }>("/attendees");
    setAttendees(response.attendees);
  }

  async function loadFields() {
    const response = await api<{ fields: FormField[] }>("/form-fields");
    setFields(response.fields);
  }

  async function loadUsers() {
    const response = await api<{ users: UserRow[]; scopes: Station[] }>("/auth/users");
    setUsers(response.users);
    setScopes(response.scopes);
  }

  useEffect(() => {
    loadAttendees().catch(() => undefined);
    loadFields().catch(() => undefined);
    loadUsers().catch(() => undefined);
  }, []);

  async function upload(path: string) {
    if (!file) return;
    const data = new FormData();
    data.append("file", file);
    const response = await api<any>(path, { method: "POST", body: data });
    setMessage(`${response.acceptedRows ?? response.batch?.accepted_rows ?? 0} rows accepted.`);
    await loadAttendees();
  }

  async function createAttendee(event: FormEvent) {
    event.preventDefault();
    await api("/attendees", { method: "POST", body: JSON.stringify({ ...form, customFields: customValues }) });
    setForm({ name: "", email: "", phone: "", college: "", department: "" });
    setCustomValues({});
    setMessage("On-spot registration saved.");
    await loadAttendees();
  }

  function startNewField() {
    setEditingFieldId(null);
    setFieldForm({ fieldKey: "", label: "", fieldType: "text", required: false, options: "", sortOrder: fields.length + 1, active: true });
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
      active: field.active
    });
    setTab("form");
  }

  async function saveField(event: FormEvent) {
    event.preventDefault();
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
  }

  async function deleteField(field: FormField) {
    const ok = window.confirm(`Delete "${field.label}" from the registration form? Existing attendee metadata will remain stored.`);
    if (!ok) return;
    await api(`/form-fields/${field.id}`, { method: "DELETE" });
    setMessage("Registration field deleted.");
    await loadFields();
  }

  async function generateBatch() {
    const response = await api<any>("/qr/batches", { method: "POST", body: JSON.stringify({ name: `Event batch ${new Date().toLocaleString()}` }) });
    setMessage(`Generated ${response.batch.generatedCount} QR codes.`);
  }

  async function sendBatch() {
    const response = await api<any>("/qr/send", { method: "POST", body: JSON.stringify({ mode: "unsent" }) });
    setMessage(`Attempted ${response.attempted} emails.`);
  }

  async function exportCsv() {
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
  }

  async function createRule(event: FormEvent) {
    event.preventDefault();
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
  }

  async function createUser(event: FormEvent) {
    event.preventDefault();
    const payload = {
      name: userForm.name,
      email: userForm.email,
      password: userForm.password,
      role: userForm.role,
      active: userForm.active,
      stations: userForm.stations.split(",").map((station) => station.trim()).filter(Boolean)
    };
    await api(editingUserId ? `/auth/users/${editingUserId}` : "/auth/users", {
      method: editingUserId ? "PUT" : "POST",
      body: JSON.stringify(payload)
    });
    setUserForm({ name: "", email: "", password: "", role: "volunteer", active: true, stations: "entry" });
    setEditingUserId(null);
    setMessage(editingUserId ? "User updated." : "User created.");
    await loadUsers();
  }

  function editUser(user: UserRow) {
    setEditingUserId(user.id);
    setUserForm({
      name: user.name,
      email: user.email,
      password: "",
      role: user.role,
      active: user.active,
      stations: user.stations.join(",")
    });
  }

  async function deleteUser(user: UserRow) {
    const ok = window.confirm(`Delete ${user.name}? This removes their login and station scopes.`);
    if (!ok) return;
    await api(`/auth/users/${user.id}`, { method: "DELETE" });
    setMessage("User deleted.");
    await loadUsers();
  }

  function toggleScope(scope: Station) {
    const selected = new Set(userForm.stations.split(",").map((value) => value.trim()).filter(Boolean));
    if (selected.has(scope)) selected.delete(scope);
    else selected.add(scope);
    setUserForm({ ...userForm, stations: Array.from(selected).join(",") });
  }

  function cancelUserEdit() {
    setEditingUserId(null);
    setUserForm({ name: "", email: "", password: "", role: "volunteer", active: true, stations: "entry" });
  }

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
          ["users", "Users"]
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
          <form className="panel wide-panel" onSubmit={createAttendee}>
            <h3>On-spot registration</h3>
            <div className="form-grid">
              {Object.keys(form).map((key) => (
                <label key={key}>{key}<input value={(form as any)[key]} onChange={(event) => setForm({ ...form, [key]: event.target.value })} required={key === "name" || key === "email"} /></label>
              ))}
              {fields.filter((field) => field.active).map((field) => (
                <DynamicField key={field.id} field={field} value={customValues[field.fieldKey]} onChange={(value) => setCustomValues({ ...customValues, [field.fieldKey]: value })} />
              ))}
            </div>
            <button type="submit"><Save size={16} /> Save attendee</button>
          </form>
          <div className="panel full-span">
            <h3>Recent registrations</h3>
            <div className="table-wrap">
              <table>
                <thead><tr><th>Name</th><th>Email</th><th>Phone</th><th>College</th><th>Department</th><th>Custom fields</th></tr></thead>
                <tbody>{attendees.map((attendee) => (
                  <tr key={attendee.id}>
                    <td>{attendee.name}</td>
                    <td>{attendee.email}</td>
                    <td>{attendee.phone}</td>
                    <td>{attendee.college}</td>
                    <td>{attendee.department}</td>
                    <td><CustomFieldChips values={attendee.metadata?.customFields ?? {}} fields={fields} /></td>
                  </tr>
                ))}</tbody>
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
                    <span>{field.fieldKey} - {field.fieldType} - order {field.sortOrder}</span>
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
            <div>
              <p className="field-caption">Available scopes</p>
              <div className="scope-grid">
                {scopes.map((scope) => (
                  <button type="button" key={scope} className={userForm.stations.split(",").includes(scope) ? "scope-chip active" : "scope-chip"} onClick={() => toggleScope(scope)}>
                    <ShieldCheck size={15} /> {scope}
                  </button>
                ))}
              </div>
            </div>
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
                    <span>{user.email} - {user.role}</span>
                    <div className="scope-row">{(user.stations.length ? user.stations : ["admin"]).map((scope) => <small key={scope}>{scope}</small>)}</div>
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
