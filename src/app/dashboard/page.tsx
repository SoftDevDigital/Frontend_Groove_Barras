// src/app/dashboard/page.tsx
"use client";
import Guard from "@/components/Guard";
import Navbar from "@/components/Navbar";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { getToken, hasRole } from "@/lib/auth";
import btn from "@/styles/Buttons.module.css";

type TopProduct = { name: string; sales: number };
type RecentTicket = { id: string; customerName: string; total: number; createdAt: string };

type AdminDashboard = {
  totalSales: number;
  totalExpenses: number;
  activeEvents: number;
  lowStockProducts: number;
  todaySales: number;
  todayExpenses: number;
  topProducts: TopProduct[];
  recentTickets: RecentTicket[];
};

/* Reportes */
type ReportRow = { id: string; amount: number; description: string };
type ReportSummary = { totalRecords: number; totalAmount: number; averageAmount: number };
type ReportResponse = {
  id: string;
  type: string;
  title: string;
  description: string;
  data: ReportRow[];
  summary: ReportSummary;
  generatedAt: string;
  generatedBy: string;
  period: { from: string; to: string };
};

/* Auditoría */
type AuditLog = {
  id: string;
  userId: string;
  action: string;
  entityType: string;
  entityId: string;
  timestamp: string;
  details?: Record<string, any>;
};

/* 👇 NUEVO: Settings */
type SettingResponse = {
  id: string;
  key: string;
  value: any;
  updatedAt: string;
  updatedBy: string;
};

/* 👇 NUEVO: Backup (POST /admin/backup) */
type BackupResponse = {
  id: string;
  filename: string;
  size: number;
  createdAt: string;
  status: "pending" | "running" | "completed" | "failed";
  downloadUrl: string | null;
};

/* 👇 NUEVO: Export (POST /admin/export) */
type ExportResponse = {
  id: string;
  type: string;
  format: string;
  status: "pending" | "processing" | "completed" | "failed";
  requestedBy: string;
  requestedAt: string;
  downloadUrl: string | null;
};

/* 👇 NUEVO: Notify (POST /admin/notify) */
type NotifyResponse = {
  id: string;
  type: string;
  recipient: string;
  subject: string;
  message: string;
  status: "pending" | "queued" | "sent" | "failed";
  createdAt: string;
};

export default function DashboardPage() {
  const [data, setData] = useState<AdminDashboard | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  /* Reportes */
  const [reportType, setReportType] = useState<"sales" | "expenses">("sales");
  const [reportFormat, setReportFormat] = useState<"json">("json");
  const [dateFrom, setDateFrom] = useState<string>(() => defaultFrom());
  const [dateTo, setDateTo] = useState<string>(() => defaultTo());
  const [report, setReport] = useState<ReportResponse | null>(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportErr, setReportErr] = useState<string | null>(null);

  /* Auditoría */
  const [auditUserId, setAuditUserId] = useState<string>("");
  const [auditAction, setAuditAction] = useState<string>("");
  const [audit, setAudit] = useState<AuditLog[] | null>(null);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditErr, setAuditErr] = useState<string | null>(null);

  /* 👇 NUEVO: Settings (PATCH /admin/settings) */
  const [settingKey, setSettingKey] = useState<string>("tax_rate");
  const [settingValue, setSettingValue] = useState<string>("0.19");
  const [settingKind, setSettingKind] = useState<"auto" | "string" | "number" | "boolean" | "json">("auto");
  const [settingSaving, setSettingSaving] = useState(false);
  const [settingErr, setSettingErr] = useState<string | null>(null);
  const [settingMsg, setSettingMsg] = useState<string | null>(null);
  const [lastSetting, setLastSetting] = useState<SettingResponse | null>(null);

  /* 👇 NUEVO: Backup (POST /admin/backup) */
  const [backupDesc, setBackupDesc] = useState<string>("Backup mensual");
  const [backupLoading, setBackupLoading] = useState(false);
  const [backupErr, setBackupErr] = useState<string | null>(null);
  const [backupMsg, setBackupMsg] = useState<string | null>(null);
  const [backupRes, setBackupRes] = useState<BackupResponse | null>(null);

  /* 👇 NUEVO: Export (POST /admin/export) */
  const [exportType, setExportType] = useState<string>("report");
  const [exportFormat, setExportFormat] = useState<string>("excel");
  const [exportFrom, setExportFrom] = useState<string>(() => defaultFrom());
  const [exportTo, setExportTo] = useState<string>(() => defaultTo());
  const [exportLoading, setExportLoading] = useState(false);
  const [exportErr, setExportErr] = useState<string | null>(null);
  const [exportMsg, setExportMsg] = useState<string | null>(null);
  const [exportRes, setExportRes] = useState<ExportResponse | null>(null);

  /* 👇 NUEVO: Notificación (POST /admin/notify) */
  const [notifyType, setNotifyType] = useState<string>("email");
  const [notifyRecipient, setNotifyRecipient] = useState<string>("admin@bar.com");
  const [notifySubject, setNotifySubject] = useState<string>("Reporte diario");
  const [notifyMessage, setNotifyMessage] = useState<string>("El reporte está listo");
  const [notifyLoading, setNotifyLoading] = useState(false);
  const [notifyErr, setNotifyErr] = useState<string | null>(null);
  const [notifyMsg, setNotifyMsg] = useState<string | null>(null);
  const [notifyRes, setNotifyRes] = useState<NotifyResponse | null>(null);

  async function load() {
    setLoading(true);
    setErr(null);
    setData(null);
    try {
      if (!hasRole(["admin"])) {
        setErr("Se requieren permisos de administrador para ver este dashboard.");
        return;
      }
      const token = getToken();
      const { data } = await api.get<AdminDashboard>("/admin/dashboard", {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      setData(data);
    } catch (e: any) {
      setErr(e?.response?.data?.message || "Error al cargar el dashboard");
    } finally {
      setLoading(false);
    }
  }

  async function generateReport() {
    setReport(null);
    setReportErr(null);
    setReportLoading(true);
    try {
      if (!hasRole(["admin"])) {
        setReportErr("Se requieren permisos de administrador para generar reportes.");
        return;
      }
      const token = getToken();
      const qs = new URLSearchParams({
        type: reportType,
        format: reportFormat,
        dateFrom,
        dateTo,
      }).toString();
      const { data } = await api.get<ReportResponse>(`/admin/reports?${qs}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      setReport(data || null);
    } catch (e: any) {
      setReportErr(e?.response?.data?.message || "Error al generar el reporte");
    } finally {
      setReportLoading(false);
    }
  }

  async function loadAudit() {
    setAudit(null);
    setAuditErr(null);
    setAuditLoading(true);
    try {
      if (!hasRole(["admin"])) {
        setAuditErr("Se requieren permisos de administrador para ver los logs.");
        return;
      }
      const token = getToken();
      const params = new URLSearchParams({});
      if (auditUserId.trim()) params.append("userId", auditUserId.trim());
      if (auditAction.trim()) params.append("action", auditAction.trim());
      const { data } = await api.get<AuditLog[]>(`/admin/audit?${params.toString()}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      setAudit(Array.isArray(data) ? data : []);
    } catch (e: any) {
      setAuditErr(e?.response?.data?.message || "Error al obtener logs de auditoría");
    } finally {
      setAuditLoading(false);
    }
  }

  /* 👇 NUEVO: actualizar configuración */
  function coerceValue(raw: string, kind: typeof settingKind) {
    const t = raw.trim();
    if (kind === "string") return t;
    if (kind === "number") {
      const n = Number(t);
      if (!Number.isFinite(n)) throw new Error("El valor no es un número válido.");
      return n;
    }
    if (kind === "boolean") {
      if (t.toLowerCase() === "true") return true;
      if (t.toLowerCase() === "false") return false;
      throw new Error('Booleano inválido: usa "true" o "false".');
    }
    if (kind === "json") {
      try { return JSON.parse(t); } catch { throw new Error("JSON inválido."); }
    }
    // auto: intenta number → boolean → json → string
    const n = Number(t);
    if (t !== "" && Number.isFinite(n)) return n;
    if (t.toLowerCase() === "true") return true;
    if (t.toLowerCase() === "false") return false;
    if ((t.startsWith("{") && t.endsWith("}")) || (t.startsWith("[") && t.endsWith("]"))) {
      try { return JSON.parse(t); } catch { /* fallback string */ }
    }
    return t;
  }

  async function updateSetting() {
    setSettingErr(null);
    setSettingMsg(null);
    setLastSetting(null);
    try {
      if (!hasRole(["admin"])) {
        setSettingErr("Se requieren permisos de administrador para actualizar configuraciones.");
        return;
      }
      const key = settingKey.trim();
      if (!key) {
        setSettingErr("La clave (key) es obligatoria.");
        return;
      }
      const value = coerceValue(settingValue, settingKind);

      setSettingSaving(true);
      const token = getToken();
      const { data } = await api.patch<SettingResponse>(
        "/admin/settings",
        { key, value },
        {
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        }
      );
      setLastSetting(data);
      setSettingMsg("Configuración actualizada correctamente.");
    } catch (e: any) {
      setSettingErr(e?.response?.data?.message || e?.message || "Error al actualizar configuración");
    } finally {
      setSettingSaving(false);
    }
  }

  /* 👇 NUEVO: crear backup */
  async function createBackup() {
    setBackupErr(null);
    setBackupMsg(null);
    setBackupRes(null);
    try {
      if (!hasRole(["admin"])) {
        setBackupErr("Se requieren permisos de administrador para crear backups.");
        return;
      }
      const desc = backupDesc.trim();
      if (!desc) {
        setBackupErr("La descripción es obligatoria.");
        return;
      }
      setBackupLoading(true);
      const token = getToken();
      const { data } = await api.post<BackupResponse>(
        "/admin/backup",
        { description: desc },
        {
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        }
      );
      setBackupRes(data);
      setBackupMsg("Backup solicitado correctamente (201 Created).");
    } catch (e: any) {
      setBackupErr(e?.response?.data?.message || e?.message || "Error al crear backup");
    } finally {
      setBackupLoading(false);
    }
  }

  /* 👇 NUEVO: exportar datos */
  async function exportData() {
    setExportErr(null);
    setExportMsg(null);
    setExportRes(null);
    try {
      if (!hasRole(["admin"])) {
        setExportErr("Se requieren permisos de administrador para exportar datos.");
        return;
      }
      if (!exportFrom || !exportTo) {
        setExportErr("Completá el rango de fechas.");
        return;
      }
      setExportLoading(true);
      const token = getToken();
      const { data } = await api.post<ExportResponse>(
        "/admin/export",
        {
          type: exportType,
          format: exportFormat,
          dateFrom: exportFrom,
          dateTo: exportTo,
        },
        {
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        }
      );
      setExportRes(data);
      setExportMsg("Exportación solicitada (201 Created).");
    } catch (e: any) {
      setExportErr(e?.response?.data?.message || e?.message || "Error al exportar datos");
    } finally {
      setExportLoading(false);
    }
  }

  /* 👇 NUEVO: enviar notificación */
  async function sendNotification() {
    setNotifyErr(null);
    setNotifyMsg(null);
    setNotifyRes(null);
    try {
      if (!hasRole(["admin"])) {
        setNotifyErr("Se requieren permisos de administrador para enviar notificaciones.");
        return;
      }

      const type = notifyType.trim();
      const recipient = notifyRecipient.trim();
      const subject = notifySubject.trim();
      const message = notifyMessage.trim();

      if (!type) return setNotifyErr("El tipo es obligatorio.");
      if (!recipient) return setNotifyErr("El destinatario es obligatorio.");
      if (!subject) return setNotifyErr("El asunto es obligatorio.");
      if (!message) return setNotifyErr("El mensaje es obligatorio.");

      setNotifyLoading(true);
      const token = getToken();
      const { data } = await api.post<NotifyResponse>(
        "/admin/notify",
        { type, recipient, subject, message },
        {
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        }
      );
      setNotifyRes(data);
      setNotifyMsg("Notificación enviada (201 Created).");
    } catch (e: any) {
      const raw = e?.response?.data?.message ?? e?.response?.data ?? e?.message ?? "Error al enviar notificación";
      setNotifyErr(toErrorText(raw));
    } finally {
      setNotifyLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  return (
    <Guard roles={["admin","bar_user"]}>
      <Navbar />
      <main style={{padding:20, display:"grid", gap:12}}>
        <header style={{ display:"flex", gap:12, alignItems:"center", flexWrap:"wrap" }}>
          <h1 style={{ marginRight:"auto" }}>Dashboard</h1>
          <button className={btn.secondary} onClick={load} disabled={loading}>
            {loading ? "Actualizando…" : "Refrescar"}
          </button>
        </header>

        <p style={{ marginTop: 0 }}>Bienvenido al sistema de barras.</p>

        {err && (
          <div style={{ border:"1px solid #fecaca", background:"#fee2e2", color:"#7f1d1d", padding:10, borderRadius:10 }}>
            {err}
          </div>
        )}

        {!err && (
          <>
            {/* Métricas */}
            <section style={{display:"grid",gridTemplateColumns:"repeat(auto-fit, minmax(220px, 1fr))",gap:12}}>
              <Card title="Ventas totales" value={formatMoney(data?.totalSales)} />
              <Card title="Gastos totales" value={formatMoney(data?.totalExpenses)} />
              <Card title="Eventos activos" value={data?.activeEvents ?? "—"} />
              <Card title="Productos con poco stock" value={data?.lowStockProducts ?? "—"} />
              <Card title="Ventas de hoy" value={formatMoney(data?.todaySales)} />
              <Card title="Gastos de hoy" value={formatMoney(data?.todayExpenses)} />
            </section>

            {/* Top productos */}
            <section style={{border:"1px solid #e5e7eb",background:"#fff",borderRadius:12,padding:12,display:"grid",gap:10}}>
              <h3 style={{ margin:0 }}>Top productos</h3>
              {loading && <span style={{ color:"#6b7280" }}>Cargando…</span>}
              {!loading && (data?.topProducts?.length ?? 0) === 0 && <span style={{ color:"#6b7280" }}>Sin datos.</span>}
              {!loading && (data?.topProducts?.length ?? 0) > 0 && (
                <div style={{ overflowX:"auto" }}>
                  <table style={{ width:"100%", borderCollapse:"collapse" }}>
                    <thead><tr><th style={th}>Producto</th><th style={{ ...th, textAlign:"right" }}>Ventas</th></tr></thead>
                    <tbody>
                      {data!.topProducts.map((p,i)=>(
                        <tr key={i}><td style={td}>{p.name}</td><td style={{ ...td, textAlign:"right" }}>{formatMoney(p.sales)}</td></tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            {/* Tickets recientes */}
            <section style={{border:"1px solid #e5e7eb",background:"#fff",borderRadius:12,padding:12,display:"grid",gap:10}}>
              <h3 style={{ margin:0 }}>Tickets recientes</h3>
              {loading && <span style={{ color:"#6b7280" }}>Cargando…</span>}
              {!loading && (data?.recentTickets?.length ?? 0) === 0 && <span style={{ color:"#6b7280" }}>Sin datos.</span>}
              {!loading && (data?.recentTickets?.length ?? 0) > 0 && (
                <div style={{ overflowX:"auto" }}>
                  <table style={{ width:"100%", borderCollapse:"collapse" }}>
                    <thead>
                      <tr>
                        <th style={th}>ID</th><th style={th}>Cliente</th>
                        <th style={{ ...th, textAlign:"right" }}>Total</th><th style={th}>Creado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data!.recentTickets.map((t)=>(
                        <tr key={t.id}>
                          <td style={td}><code>{t.id}</code></td>
                          <td style={td}>{t.customerName}</td>
                          <td style={{ ...td, textAlign:"right" }}>{formatMoney(t.total)}</td>
                          <td style={td}>{formatDate(t.createdAt)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            {/* Reportes */}
            <section style={{border:"1px solid #e5e7eb",background:"#fff",borderRadius:12,padding:12,display:"grid",gap:12}}>
              <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                <h3 style={{ margin:0 }}>Generar reportes</h3>
                {reportLoading && <span style={{ color:"#6b7280" }}>Generando…</span>}
                {reportErr && <span style={{ marginLeft:"auto", color:"#7f1d1d" }}>{reportErr}</span>}
              </div>

              <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(180px, 1fr))", gap:8 }}>
                <div style={{ display:"grid", gap:6 }}>
                  <label>Tipo</label>
                  <select value={reportType} onChange={(e)=>setReportType(e.target.value as any)}>
                    <option value="sales">Ventas</option>
                    <option value="expenses">Gastos</option>
                  </select>
                </div>
                <div style={{ display:"grid", gap:6 }}>
                  <label>Formato</label>
                  <select value={reportFormat} onChange={(e)=>setReportFormat(e.target.value as any)}>
                    <option value="json">JSON</option>
                  </select>
                </div>
                <div style={{ display:"grid", gap:6 }}>
                  <label>Desde</label>
                  <input type="date" value={dateFrom} onChange={(e)=>setDateFrom(e.target.value)} />
                </div>
                <div style={{ display:"grid", gap:6 }}>
                  <label>Hasta</label>
                  <input type="date" value={dateTo} onChange={(e)=>setDateTo(e.target.value)} />
                </div>
              </div>

              <div style={{ display:"flex", gap:8 }}>
                <button className={btn.primary} onClick={generateReport} disabled={reportLoading}>
                  {reportLoading ? "Generando…" : "Generar reporte"}
                </button>
              </div>

              {report && !reportErr && (
                <div style={{ display:"grid", gap:10 }}>
                  <strong>{report.title}</strong>
                  <span style={{ color:"#6b7280" }}>{report.description}</span>
                  <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(220px, 1fr))", gap:12 }}>
                    <Card title="Total registros" value={report.summary.totalRecords} />
                    <Card title="Monto total" value={formatMoney(report.summary.totalAmount)} />
                    <Card title="Promedio" value={formatMoney(report.summary.averageAmount)} />
                    <Card title="Generado" value={formatDate(report.generatedAt)} />
                  </div>
                  <div style={{ overflowX:"auto" }}>
                    <table style={{ width:"100%", borderCollapse:"collapse" }}>
                      <thead><tr><th style={th}>ID</th><th style={th}>Descripción</th><th style={{ ...th, textAlign:"right" }}>Monto</th></tr></thead>
                      <tbody>
                        {report.data?.length ? report.data.map((r)=>(
                          <tr key={r.id}><td style={td}><code>{r.id}</code></td><td style={td}>{r.description}</td><td style={{ ...td, textAlign:"right" }}>{formatMoney(r.amount)}</td></tr>
                        )) : <tr><td style={td} colSpan={3}>Sin resultados.</td></tr>}
                      </tbody>
                    </table>
                  </div>
                  <small style={{ color:"#6b7280" }}>Período: {formatDate(report.period.from)} → {formatDate(report.period.to)}</small>
                  <details><summary>Ver JSON</summary><pre style={{ background:"#f9fafb", padding:12, borderRadius:8, overflowX:"auto" }}>{JSON.stringify(report, null, 2)}</pre></details>
                </div>
              )}
            </section>

            {/* Auditoría */}
            <section style={{border:"1px solid #e5e7eb",background:"#fff",borderRadius:12,padding:12,display:"grid",gap:12}}>
              <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                <h3 style={{ margin:0 }}>Logs de auditoría</h3>
                {auditLoading && <span style={{ color:"#6b7280" }}>Cargando…</span>}
                {auditErr && <span style={{ marginLeft:"auto", color:"#7f1d1d" }}>{auditErr}</span>}
              </div>

              <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(220px, 1fr))", gap:8 }}>
                <div style={{ display:"grid", gap:6 }}>
                  <label>Usuario (userId)</label>
                  <input value={auditUserId} onChange={(e)=>setAuditUserId(e.target.value)} placeholder="user-123" />
                </div>
                <div style={{ display:"grid", gap:6 }}>
                  <label>Acción</label>
                  <select value={auditAction} onChange={(e)=>setAuditAction(e.target.value)}>
                    <option value="">Todas</option>
                    <option value="create">create</option>
                    <option value="update">update</option>
                    <option value="delete">delete</option>
                  </select>
                </div>
              </div>

              <div style={{ display:"flex", gap:8 }}>
                <button className={btn.secondary} onClick={loadAudit} disabled={auditLoading}>
                  {auditLoading ? "Buscando…" : "Buscar logs"}
                </button>
              </div>

              <div style={{ overflowX:"auto" }}>
                <table style={{ width:"100%", borderCollapse:"collapse" }}>
                  <thead>
                    <tr>
                      <th style={th}>ID</th><th style={th}>Usuario</th><th style={th}>Acción</th>
                      <th style={th}>Entidad</th><th style={th}>Entidad ID</th><th style={th}>Fecha</th><th style={th}>Detalles</th>
                    </tr>
                  </thead>
                  <tbody>
                    {!audit?.length ? (
                      <tr><td style={td} colSpan={7}>Sin resultados.</td></tr>
                    ) : audit.map((a)=>(
                      <tr key={a.id}>
                        <td style={td}><code>{a.id}</code></td>
                        <td style={td}><code>{a.userId}</code></td>
                        <td style={td}><code>{a.action}</code></td>
                        <td style={td}>{a.entityType}</td>
                        <td style={td}><code>{a.entityId}</code></td>
                        <td style={td}>{formatDate(a.timestamp)}</td>
                        <td style={td}>
                          <details><summary>Ver</summary>
                            <pre style={{ background:"#f9fafb", padding:8, borderRadius:8, overflowX:"auto", margin:0 }}>{JSON.stringify(a.details ?? {}, null, 2)}</pre>
                          </details>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            {/* 👇 NUEVO: Actualizar configuraciones */}
            <section style={{border:"1px solid #e5e7eb",background:"#fff",borderRadius:12,padding:12,display:"grid",gap:12}}>
              <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                <h3 style={{ margin:0 }}>Actualizar configuraciones</h3>
                {settingSaving && <span style={{ color:"#6b7280" }}>Guardando…</span>}
                {settingErr && <span style={{ marginLeft:"auto", color:"#7F1D1D" }}>{settingErr}</span>}
                {settingMsg && !settingErr && <span style={{ marginLeft:"auto", color:"#065F46" }}>{settingMsg}</span>}
              </div>

              <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(220px, 1fr))", gap:8 }}>
                <div style={{ display:"grid", gap:6 }}>
                  <label>Key</label>
                  <input value={settingKey} onChange={(e)=>setSettingKey(e.target.value)} placeholder="tax_rate" />
                </div>

                <div style={{ display:"grid", gap:6 }}>
                  <label>Value</label>
                  <input value={settingValue} onChange={(e)=>setSettingValue(e.target.value)} placeholder="0.19" />
                </div>

                <div style={{ display:"grid", gap:6 }}>
                  <label>Tipo de valor</label>
                  <select value={settingKind} onChange={(e)=>setSettingKind(e.target.value as any)}>
                    <option value="auto">Auto (detecta)</option>
                    <option value="number">Number</option>
                    <option value="boolean">Boolean</option>
                    <option value="json">JSON</option>
                    <option value="string">String</option>
                  </select>
                </div>
              </div>

              <div style={{ display:"flex", gap:8 }}>
                <button className={btn.primary} onClick={updateSetting} disabled={settingSaving}>
                  {settingSaving ? "Guardando…" : "Actualizar setting"}
                </button>
              </div>

              {lastSetting && (
                <div style={{ display:"grid", gap:8 }}>
                  <strong>Última actualización</strong>
                  <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(220px, 1fr))", gap:12 }}>
                    <Card title="ID" value={lastSetting.id} />
                    <Card title="Key" value={lastSetting.key} />
                    <Card title="Actualizado por" value={lastSetting.updatedBy} />
                    <Card title="Fecha" value={formatDate(lastSetting.updatedAt)} />
                  </div>
                  <details>
                    <summary>Ver respuesta completa</summary>
                    <pre style={{ background:"#f9fafb", padding:12, borderRadius:8, overflowX:"auto" }}>
{JSON.stringify(lastSetting, null, 2)}
                    </pre>
                  </details>
                </div>
              )}
            </section>

            {/* 👇 NUEVO: Crear backup (POST /admin/backup) */}
            <section style={{border:"1px solid #e5e7eb",background:"#fff",borderRadius:12,padding:12,display:"grid",gap:12}}>
              <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                <h3 style={{ margin:0 }}>Crear backup</h3>
                {backupLoading && <span style={{ color:"#6b7280" }}>Creando…</span>}
                {backupErr && <span style={{ marginLeft:"auto", color:"#7f1d1d" }}>{backupErr}</span>}
                {backupMsg && !backupErr && <span style={{ marginLeft:"auto", color:"#065F46" }}>{backupMsg}</span>}
              </div>

              <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(220px, 1fr))", gap:8 }}>
                <div style={{ display:"grid", gap:6 }}>
                  <label>Descripción</label>
                  <input
                    value={backupDesc}
                    onChange={(e)=>setBackupDesc(e.target.value)}
                    placeholder="Backup mensual"
                  />
                </div>
              </div>

              <div style={{ display:"flex", gap:8 }}>
                <button className={btn.primary} onClick={createBackup} disabled={backupLoading}>
                  {backupLoading ? "Creando…" : "Crear backup"}
                </button>
              </div>

              {backupRes && !backupErr && (
                <div style={{ display:"grid", gap:10 }}>
                  <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(220px, 1fr))", gap:12 }}>
                    <Card title="ID" value={backupRes.id} />
                    <Card title="Archivo" value={backupRes.filename} />
                    <Card title="Tamaño (bytes)" value={backupRes.size} />
                    <Card title="Estado" value={backupRes.status} />
                    <Card title="Creado" value={formatDate(backupRes.createdAt)} />
                  </div>
                  <div>
                    <strong>Descarga:</strong>{" "}
                    {backupRes.downloadUrl
                      ? <a href={backupRes.downloadUrl} target="_blank" rel="noreferrer">Link de descarga</a>
                      : <span style={{ color:"#6b7280" }}>aún no disponible</span>}
                  </div>
                  <details>
                    <summary>Ver JSON</summary>
                    <pre style={{ background:"#f9fafb", padding:12, borderRadius:8, overflowX:"auto" }}>
{JSON.stringify(backupRes, null, 2)}
                    </pre>
                  </details>
                </div>
              )}
            </section>

            {/* 👇 NUEVO: Exportar datos (POST /admin/export) */}
            <section style={{border:"1px solid #e5e7eb",background:"#fff",borderRadius:12,padding:12,display:"grid",gap:12}}>
              <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                <h3 style={{ margin:0 }}>Exportar datos</h3>
                {exportLoading && <span style={{ color:"#6b7280" }}>Exportando…</span>}
                {exportErr && <span style={{ marginLeft:"auto", color:"#7f1d1d" }}>{exportErr}</span>}
                {exportMsg && !exportErr && <span style={{ marginLeft:"auto", color:"#065F46" }}>{exportMsg}</span>}
              </div>

              <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(180px, 1fr))", gap:8 }}>
                <div style={{ display:"grid", gap:6 }}>
                  <label>Tipo</label>
                  <select value={exportType} onChange={(e)=>setExportType(e.target.value)}>
                    <option value="report">report</option>
                    {/* agrega más tipos si tu backend los soporta */}
                  </select>
                </div>
                <div style={{ display:"grid", gap:6 }}>
                  <label>Formato</label>
                  <select value={exportFormat} onChange={(e)=>setExportFormat(e.target.value)}>
                    <option value="excel">excel</option>
                    <option value="csv">csv</option>
                    <option value="pdf">pdf</option>
                  </select>
                </div>
                <div style={{ display:"grid", gap:6 }}>
                  <label>Desde</label>
                  <input type="date" value={exportFrom} onChange={(e)=>setExportFrom(e.target.value)} />
                </div>
                <div style={{ display:"grid", gap:6 }}>
                  <label>Hasta</label>
                  <input type="date" value={exportTo} onChange={(e)=>setExportTo(e.target.value)} />
                </div>
              </div>

              <div style={{ display:"flex", gap:8 }}>
                <button className={btn.primary} onClick={exportData} disabled={exportLoading}>
                  {exportLoading ? "Exportando…" : "Solicitar exportación"}
                </button>
              </div>

              {exportRes && !exportErr && (
                <div style={{ display:"grid", gap:10 }}>
                  <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(220px, 1fr))", gap:12 }}>
                    <Card title="ID" value={exportRes.id} />
                    <Card title="Tipo" value={exportRes.type} />
                    <Card title="Formato" value={exportRes.format} />
                    <Card title="Estado" value={exportRes.status} />
                    <Card title="Solicitado por" value={exportRes.requestedBy} />
                    <Card title="Solicitado en" value={formatDate(exportRes.requestedAt)} />
                  </div>
                  <div>
                    <strong>Descarga:</strong>{" "}
                    {exportRes.downloadUrl
                      ? <a href={exportRes.downloadUrl} target="_blank" rel="noreferrer">Link de descarga</a>
                      : <span style={{ color:"#6b7280" }}>aún no disponible</span>}
                  </div>
                  <details>
                    <summary>Ver JSON</summary>
                    <pre style={{ background:"#f9fafb", padding:12, borderRadius:8, overflowX:"auto" }}>
{JSON.stringify(exportRes, null, 2)}
                    </pre>
                  </details>
                </div>
              )}
            </section>

            {/* 👇 NUEVO: Enviar notificación (POST /admin/notify) */}
            <section style={{border:"1px solid #e5e7eb",background:"#fff",borderRadius:12,padding:12,display:"grid",gap:12}}>
              <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                <h3 style={{ margin:0 }}>Enviar notificación</h3>
                {notifyLoading && <span style={{ color:"#6b7280" }}>Enviando…</span>}
                {notifyErr && <span style={{ marginLeft:"auto", color:"#7f1d1d" }}>{notifyErr}</span>}
                {notifyMsg && !notifyErr && <span style={{ marginLeft:"auto", color:"#065F46" }}>{notifyMsg}</span>}
              </div>

              <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(220px, 1fr))", gap:8 }}>
                <div style={{ display:"grid", gap:6 }}>
                  <label>Tipo</label>
                  <select value={notifyType} onChange={(e)=>setNotifyType(e.target.value)}>
                    <option value="email">email</option>
                    {/* agrega otros tipos si tu backend lo soporta (sms, push, etc.) */}
                  </select>
                </div>

                <div style={{ display:"grid", gap:6 }}>
                  <label>Destinatario</label>
                  <input value={notifyRecipient} onChange={(e)=>setNotifyRecipient(e.target.value)} placeholder="admin@bar.com" />
                </div>

                <div style={{ display:"grid", gap:6 }}>
                  <label>Asunto</label>
                  <input value={notifySubject} onChange={(e)=>setNotifySubject(e.target.value)} placeholder="Reporte diario" />
                </div>
              </div>

              <div style={{ display:"grid", gap:6 }}>
                <label>Mensaje</label>
                <textarea
                  value={notifyMessage}
                  onChange={(e)=>setNotifyMessage(e.target.value)}
                  placeholder="El reporte está listo"
                  rows={4}
                  style={{ resize:"vertical" }}
                />
              </div>

              <div style={{ display:"flex", gap:8 }}>
                <button className={btn.primary} onClick={sendNotification} disabled={notifyLoading}>
                  {notifyLoading ? "Enviando…" : "Enviar notificación"}
                </button>
              </div>

              {notifyRes && !notifyErr && (
                <div style={{ display:"grid", gap:10 }}>
                  <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(220px, 1fr))", gap:12 }}>
                    <Card title="ID" value={notifyRes.id} />
                    <Card title="Tipo" value={notifyRes.type} />
                    <Card title="Destinatario" value={notifyRes.recipient} />
                    <Card title="Asunto" value={notifyRes.subject} />
                    <Card title="Estado" value={notifyRes.status} />
                    <Card title="Creado" value={formatDate(notifyRes.createdAt)} />
                  </div>
                  <details>
                    <summary>Ver JSON</summary>
                    <pre style={{ background:"#f9fafb", padding:12, borderRadius:8, overflowX:"auto" }}>
{JSON.stringify(notifyRes, null, 2)}
                    </pre>
                  </details>
                </div>
              )}
            </section>
          </>
        )}
      </main>
    </Guard>
  );
}

function Card({ title, value }: { title: string; value: string | number }) {
  return (
    <div style={{background:"#fff",border:"1px solid #e5e7eb",borderRadius:12,padding:14,display:"grid",gap:6}}>
      <span style={{ color:"#6b7280", fontSize:13, fontWeight:600 }}>{title}</span>
      <span style={{ fontSize:22, fontWeight:800 }}>{value ?? "—"}</span>
    </div>
  );
}

const th: React.CSSProperties = { textAlign:"left", padding:"8px 10px", borderBottom:"1px solid #e5e7eb", fontWeight:700 };
const td: React.CSSProperties = { padding:"8px 10px", borderBottom:"1px solid #f3f4f6" };

function formatDate(iso?: string) {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    return `${d.toLocaleDateString()} ${d.toLocaleTimeString([], { hour:"2-digit", minute:"2-digit" })}`;
  } catch { return String(iso); }
}
function formatMoney(n?: number) {
  if (typeof n !== "number") return "—";
  try {
    return new Intl.NumberFormat(undefined, { style:"currency", currency:"ARS", maximumFractionDigits: 2 }).format(n);
  } catch { return n.toFixed(2); }
}

/* Fechas por defecto (primer día del mes → hoy) */
function defaultFrom() { const d=new Date(); const y=d.getFullYear(); const m=String(d.getMonth()+1).padStart(2,"0"); return `${y}-${m}-01`; }
function defaultTo() { const d=new Date(); const y=d.getFullYear(); const m=String(d.getMonth()+1).padStart(2,"0"); const day=String(d.getDate()).padStart(2,"0"); return `${y}-${m}-${day}`; }
function toErrorText(x: unknown): string {
  if (x == null) return "Error desconocido";
  if (typeof x === "string") return x;
  if (x instanceof Error && x.message) return x.message;
  try {
    return JSON.stringify(x);
  } catch {
    return String(x);
  }
}
