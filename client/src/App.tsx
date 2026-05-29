import { Activity, Download, LogOut, QrCode, RefreshCcw, Send, Upload, Users } from "lucide-react";
import { Html5QrcodeScanner } from "html5-qrcode";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { API_URL, api, getSession, setSession, type Session } from "./api";
import { decryptQrPayload, hasEncryptedQrShape, hashPayload } from "./crypto";
import { deviceId, enqueueScan, flushScans, listQueuedScans } from "./offlineQueue";

type View = "dashboard" | "admin" | "scanner";
type Station = "entry" | "food" | "kit" | "custom";

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
      <aside className="sidebar">
        <div>
          <p className="eyebrow">Amaze</p>
          <h1>Reg Desk</h1>
        </div>
        <nav>
          <button className={view === "dashboard" ? "active" : ""} onClick={() => setView("dashboard")}><Activity size={18} /> Dashboard</button>
          <button className={view === "admin" ? "active" : ""} onClick={() => setView("admin")}><Users size={18} /> Admin</button>
          <button className={view === "scanner" ? "active" : ""} onClick={() => setView("scanner")}><QrCode size={18} /> Scanner</button>
        </nav>
        <button className="ghost" onClick={() => {
          setSession(null);
          setSessionState(null);
        }}><LogOut size={18} /> Sign out</button>
      </aside>
      <main>
        <header className="topbar">
          <div>
            <p className="eyebrow">Signed in as {session.user.role}</p>
            <h2>{session.user.name}</h2>
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
      <div className="panel">
        <h3>Station activity</h3>
        <table>
          <thead><tr><th>Station</th><th>Status</th><th>Count</th></tr></thead>
          <tbody>
            {(stats?.stations ?? []).map((row: any) => <tr key={`${row.station}-${row.status}`}><td>{row.station}</td><td>{row.status}</td><td>{row.count}</td></tr>)}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function Admin() {
  const [file, setFile] = useState<File | null>(null);
  const [message, setMessage] = useState("");
  const [attendees, setAttendees] = useState<any[]>([]);
  const [form, setForm] = useState({ name: "", email: "", phone: "", college: "", department: "" });
  const [ruleForm, setRuleForm] = useState({ name: "", station: "entry", startsAt: "", endsAt: "" });
  const [userForm, setUserForm] = useState({ name: "", email: "", password: "", role: "volunteer", stations: "entry" });

  async function loadAttendees() {
    const response = await api<{ attendees: any[] }>("/attendees");
    setAttendees(response.attendees);
  }

  useEffect(() => { loadAttendees().catch(() => undefined); }, []);

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
    await api("/attendees", { method: "POST", body: JSON.stringify(form) });
    setForm({ name: "", email: "", phone: "", college: "", department: "" });
    setMessage("On-spot registration saved.");
    await loadAttendees();
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
    await api("/auth/users", {
      method: "POST",
      body: JSON.stringify({
        name: userForm.name,
        email: userForm.email,
        password: userForm.password,
        role: userForm.role,
        stations: userForm.stations.split(",").map((station) => station.trim()).filter(Boolean)
      })
    });
    setUserForm({ name: "", email: "", password: "", role: "volunteer", stations: "entry" });
    setMessage("User created.");
  }

  return (
    <section className="stack">
      <div className="section-title"><h2>Admin desk</h2></div>
      {message && <p className="notice">{message}</p>}
      <div className="tool-grid">
        <div className="panel">
          <h3>Excel import</h3>
          <input type="file" accept=".xlsx" onChange={(event) => setFile(event.target.files?.[0] ?? null)} />
          <div className="row">
            <button className="secondary" onClick={() => upload("/imports/preview")}><Upload size={16} /> Preview</button>
            <button onClick={() => upload("/imports/commit")}><Upload size={16} /> Commit</button>
          </div>
        </div>
        <form className="panel" onSubmit={createAttendee}>
          <h3>On-spot registration</h3>
          {Object.keys(form).map((key) => (
            <label key={key}>{key}<input value={(form as any)[key]} onChange={(event) => setForm({ ...form, [key]: event.target.value })} required={key === "name" || key === "email"} /></label>
          ))}
          <button type="submit">Save attendee</button>
        </form>
        <div className="panel">
          <h3>QR batches</h3>
          <div className="row">
            <button onClick={generateBatch}><QrCode size={16} /> Generate</button>
            <button onClick={sendBatch}><Send size={16} /> Send unsent</button>
            <button className="secondary" onClick={exportCsv}><Download size={16} /> Export CSV</button>
          </div>
        </div>
        <form className="panel" onSubmit={createRule}>
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
        <form className="panel" onSubmit={createUser}>
          <h3>Volunteer/admin user</h3>
          <label>Name<input value={userForm.name} onChange={(event) => setUserForm({ ...userForm, name: event.target.value })} required /></label>
          <label>Email<input value={userForm.email} onChange={(event) => setUserForm({ ...userForm, email: event.target.value })} type="email" required /></label>
          <label>Password<input value={userForm.password} onChange={(event) => setUserForm({ ...userForm, password: event.target.value })} type="password" required /></label>
          <label>Role
            <select value={userForm.role} onChange={(event) => setUserForm({ ...userForm, role: event.target.value })}>
              <option value="volunteer">Volunteer</option>
              <option value="admin">Admin</option>
            </select>
          </label>
          <label>Stations<input value={userForm.stations} onChange={(event) => setUserForm({ ...userForm, stations: event.target.value })} /></label>
          <button type="submit">Create user</button>
        </form>
      </div>
      <div className="panel">
        <h3>Recent registrations</h3>
        <table>
          <thead><tr><th>Name</th><th>Email</th><th>Phone</th><th>College</th></tr></thead>
          <tbody>{attendees.map((attendee) => <tr key={attendee.id}><td>{attendee.name}</td><td>{attendee.email}</td><td>{attendee.phone}</td><td>{attendee.college}</td></tr>)}</tbody>
        </table>
      </div>
    </section>
  );
}

function Scanner({ session }: { session: Session }) {
  const [station, setStation] = useState<Station>("entry");
  const [payload, setPayload] = useState("");
  const [queueCount, setQueueCount] = useState(listQueuedScans().length);
  const [result, setResult] = useState("");
  const [decoded, setDecoded] = useState<Record<string, unknown> | null>(null);

  useEffect(() => {
    const element = document.getElementById("qr-reader");
    if (!element) return;

    const scanner = new Html5QrcodeScanner("qr-reader", { fps: 8, qrbox: { width: 240, height: 240 } }, false);
    scanner.render((text) => setPayload(text), () => undefined);
    return () => {
      scanner.clear().catch(() => undefined);
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
      <div className="panel">
        <label>Station
          <select value={station} onChange={(event) => setStation(event.target.value as Station)}>
            <option value="entry">Entry</option>
            <option value="food">Food</option>
            <option value="kit">Kit</option>
            <option value="custom">Custom</option>
          </select>
        </label>
        <div id="qr-reader" className="qr-reader" />
        <label>Encrypted QR payload
          <textarea value={payload} onChange={(event) => setPayload(event.target.value)} placeholder="Paste encrypted payload here." />
        </label>
        <button onClick={recordScan}><QrCode size={16} /> Record scan</button>
        {result && <p className="notice">{result}</p>}
        {decoded && <pre className="decoded">{JSON.stringify(decoded, null, 2)}</pre>}
      </div>
    </section>
  );
}
