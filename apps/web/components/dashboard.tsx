"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { getHealth, ApiError } from "@zeaops/api-client";
import { refreshPreferenceSchema, type RefreshPreference } from "@zeaops/contracts";
import { Button, Card, CardContent, CardHeader, CardTitle, cn } from "@zeaops/ui";
import {
  Activity,
  ArrowDownLeft,
  ArrowUpRight,
  Box,
  Check,
  ChevronRight,
  CircleHelp,
  Clock3,
  Database,
  ExternalLink,
  GitBranch,
  Globe2,
  HardDrive,
  Hexagon,
  Layers3,
  LayoutDashboard,
  LockKeyhole,
  Menu,
  Network,
  Radio,
  RefreshCw,
  Server,
  Settings2,
  ShieldCheck,
  Terminal,
  X,
  Zap,
} from "lucide-react";

const modules = [
  {
    name: "Servers",
    icon: Server,
    description: "Secure onboarding and a unified view of your VPS fleet.",
    tag: "Fleet management",
  },
  {
    name: "PostgreSQL",
    icon: Database,
    description: "Centralized database visibility, roles, and maintenance.",
    tag: "Database operations",
  },
  {
    name: "Containers",
    icon: Box,
    description: "Docker workload inventory and controlled lifecycle operations.",
    tag: "Workload management",
  },
  {
    name: "Security",
    icon: ShieldCheck,
    description: "CrowdSec signals and security posture across your servers.",
    tag: "Threat intelligence",
  },
  {
    name: "Backups",
    icon: HardDrive,
    description: "Backup policies, retention, and verified recovery workflows.",
    tag: "Data protection",
  },
  {
    name: "Object storage",
    icon: Layers3,
    description: "A unified workspace for buckets and storage visibility.",
    tag: "Storage management",
  },
];

function StatusLabel({ pending, error }: { pending: boolean; error: boolean }) {
  return (
    <span
      className={cn(
        "status-label",
        pending ? "text-slate-400" : error ? "text-amber-300" : "text-emerald-300",
      )}
    >
      <span
        className={cn("size-1.5 rounded-full bg-current", pending && "motion-safe:animate-pulse")}
      />
      {pending ? "Checking" : error ? "Unavailable" : "Operational"}
    </span>
  );
}

export function Dashboard() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const sidebarRef = useRef<HTMLElement>(null);
  const menuRef = useRef<HTMLButtonElement>(null);
  const [selected, setSelected] = useState("Overview");
  const [interval, setInterval] = useState(30000);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [saved, setSaved] = useState(false);
  const live = useQuery({
    queryKey: ["health", "live"],
    queryFn: ({ signal }) => getHealth("live", signal),
    refetchInterval: interval,
  });
  const ready = useQuery({
    queryKey: ["health", "ready"],
    queryFn: ({ signal }) => getHealth("ready", signal),
    refetchInterval: interval,
  });
  const preference = useForm<RefreshPreference>({
    resolver: zodResolver(refreshPreferenceSchema),
    defaultValues: { interval: "30" },
  });
  const checking = live.isPending || ready.isPending;
  const degraded = live.isError || ready.isError;
  const updated = Math.max(live.dataUpdatedAt, ready.dataUpdatedAt);
  const activeModule = modules.find((module) => module.name === selected);

  useEffect(() => {
    if (!mobileOpen) return;
    const sidebar = sidebarRef.current;
    const menuButton = menuRef.current;
    const focusable = () =>
      Array.from(sidebar?.querySelectorAll<HTMLElement>("a[href], button") ?? []);
    focusable()[0]?.focus();
    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape") setMobileOpen(false);
      if (event.key !== "Tab") return;
      const items = focusable();
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    }
    function handleResize() {
      if (window.innerWidth >= 1024) setMobileOpen(false);
    }
    document.addEventListener("keydown", handleKey);
    window.addEventListener("resize", handleResize);
    return () => {
      document.removeEventListener("keydown", handleKey);
      window.removeEventListener("resize", handleResize);
      if (menuButton?.getClientRects().length) menuButton.focus();
    };
  }, [mobileOpen]);

  function selectView(name: string) {
    setSelected(name);
    setMobileOpen(false);
  }
  function refresh() {
    void live.refetch();
    void ready.refetch();
  }

  return (
    <div className="app-shell">
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>
      {mobileOpen && (
        <button
          aria-label="Close navigation overlay"
          className="sidebar-overlay"
          onClick={() => setMobileOpen(false)}
        />
      )}
      <aside
        ref={sidebarRef}
        role={mobileOpen ? "dialog" : undefined}
        aria-modal={mobileOpen ? true : undefined}
        className={cn("sidebar", mobileOpen && "is-open")}
        aria-label="Primary navigation"
      >
        <Link href="/" className="brand" aria-label="ZeaOPS home">
          <span className="brand-symbol">
            <Hexagon size={29} />
            <Zap size={14} className="brand-bolt" />
          </span>
          <span>
            Zea<span className="text-cyan-300">OPS</span>
            <span className="brand-caption">INFRASTRUCTURE, UNIFIED.</span>
          </span>
        </Link>
        <div className="workspace-label">
          <span className="workspace-icon">
            <Terminal size={16} />
          </span>
          <span>
            Local workspace<small>Development environment</small>
          </span>
          <span className="ml-auto size-1.5 rounded-full bg-cyan-300" />
        </div>
        <p className="nav-heading">WORKSPACE</p>
        <nav className="space-y-1">
          <button
            onClick={() => selectView("Overview")}
            className={cn("nav-link", selected === "Overview" && "active")}
            aria-current={selected === "Overview" ? "page" : undefined}
          >
            <LayoutDashboard size={18} />
            Overview<span className="ml-auto nav-key">01</span>
          </button>
          {modules.map(({ name, icon: Icon }) => (
            <button
              key={name}
              onClick={() => selectView(name)}
              className={cn("nav-link", selected === name && "active")}
              aria-current={selected === name ? "page" : undefined}
            >
              <Icon size={18} />
              {name}
              <LockKeyhole size={12} className="ml-auto opacity-40" />
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="foundation-note">
            <span className="flex items-center gap-2 text-cyan-200">
              <GitBranch size={15} />
              Foundation release
            </span>
            <p>
              Application foundation.
              <br />
              Your infrastructure starts here.
            </p>
            <span className="font-mono text-[10px] text-slate-500">PHASE 2.1 / v0.1.0</span>
          </div>
          <button
            className="nav-link"
            onClick={() => {
              setSettingsOpen(!settingsOpen);
              setMobileOpen(false);
            }}
            aria-expanded={settingsOpen}
            aria-controls="preferences"
          >
            <Settings2 size={18} />
            Display preferences
          </button>
          <a className="nav-link" href="https://github.com/" target="_blank" rel="noreferrer">
            <CircleHelp size={18} />
            GitHub
            <ExternalLink size={12} className="ml-auto" />
          </a>
          <div className="local-profile">
            <span className="local-avatar">
              <Terminal size={17} />
            </span>
            <div>
              Local development<small>No identity provider connected</small>
            </div>
            <span className="ml-auto text-slate-500">
              <LockKeyhole size={14} />
            </span>
          </div>
        </div>
      </aside>

      <div className="main-wrap" inert={mobileOpen}>
        <header className="topbar">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden"
              ref={menuRef}
              onClick={() => setMobileOpen(!mobileOpen)}
              aria-label={mobileOpen ? "Close navigation" : "Open navigation"}
              aria-expanded={mobileOpen}
            >
              {mobileOpen ? <X size={20} /> : <Menu size={20} />}
            </Button>
            <span className="hidden text-slate-500 sm:inline">Workspace</span>
            <ChevronRight size={13} className="hidden text-slate-600 sm:inline" />
            <span>{selected}</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="environment-pill">
              <span className="size-1.5 rounded-full bg-cyan-300" />
              LOCAL / DEV
            </span>
            <span className="hidden items-center gap-2 text-xs text-slate-500 sm:flex">
              <Globe2 size={14} />
              Self-hosted
            </span>
          </div>
        </header>

        <main id="main-content" className="content" tabIndex={-1}>
          <div className="page-heading">
            <div>
              <p className="eyebrow">
                <span />
                ZEAOPS CONTROL PLANE
              </p>
              <h1>{selected === "Overview" ? "Infrastructure overview" : selected}</h1>
              <p className="page-description">
                {selected === "Overview"
                  ? "One command center. A clearer view of your infrastructure."
                  : "A dedicated home for your infrastructure operations."}
              </p>
            </div>
            <Button
              variant="outline"
              onClick={refresh}
              disabled={live.isFetching || ready.isFetching}
            >
              <RefreshCw
                size={14}
                className={cn((live.isFetching || ready.isFetching) && "motion-safe:animate-spin")}
              />
              Refresh status
            </Button>
          </div>

          {settingsOpen && (
            <Card id="preferences" className="mb-6">
              <CardHeader>
                <CardTitle>Display preferences</CardTitle>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Close preferences"
                  onClick={() => setSettingsOpen(false)}
                >
                  <X size={16} />
                </Button>
              </CardHeader>
              <CardContent>
                <form
                  className="flex flex-wrap items-end gap-4"
                  onSubmit={preference.handleSubmit((data) => {
                    setInterval(Number(data.interval) * 1000);
                    setSaved(true);
                  })}
                >
                  <label className="grid gap-2 text-sm" htmlFor="refresh-interval">
                    Health refresh interval
                    <select
                      id="refresh-interval"
                      className="rounded-lg border border-white/15 bg-slate-950 px-3 py-2"
                      {...preference.register("interval", { onChange: () => setSaved(false) })}
                    >
                      <option value="15">15 seconds</option>
                      <option value="30">30 seconds</option>
                      <option value="60">60 seconds</option>
                    </select>
                  </label>
                  <Button type="submit" size="sm">
                    Apply preference
                  </Button>
                  <p role="status" className="text-sm text-cyan-200">
                    {saved
                      ? "Preference applied for this session."
                      : "Applies to this browser session."}
                  </p>
                  {preference.formState.errors.interval && (
                    <p role="alert">Choose a supported interval.</p>
                  )}
                </form>
              </CardContent>
            </Card>
          )}

          {activeModule ? (
            <Card className="module-detail">
              <CardContent>
                <span className="detail-icon">
                  <activeModule.icon size={30} />
                </span>
                <p className="eyebrow">{activeModule.tag}</p>
                <h2>{activeModule.name} workspace</h2>
                <p>{activeModule.description}</p>
                <span className="planned-badge">
                  <LockKeyhole size={12} />
                  Planned capability
                </span>
                <p className="mt-6 text-sm text-slate-400">
                  Phase 2.1 establishes the application foundation. No servers are connected and no
                  infrastructure operations are enabled.
                </p>
                <Button className="mt-6" variant="outline" onClick={() => selectView("Overview")}>
                  Back to overview
                  <ArrowUpRight size={15} />
                </Button>
              </CardContent>
            </Card>
          ) : (
            <>
              <div className="system-banner">
                <span className={cn("signal-icon", degraded && "signal-warning")}>
                  <Radio size={19} />
                </span>
                <div>
                  <h2>
                    {checking
                      ? "Establishing local connection"
                      : degraded
                        ? "Local services need attention"
                        : "Your control plane is ready"}
                  </h2>
                  <p>
                    {checking
                      ? "Checking the API and metadata database."
                      : degraded
                        ? "Check that the local API, PostgreSQL, and migrations are running."
                        : "API and metadata database are responding. Ready for the next building block."}
                  </p>
                </div>
                <span className="banner-tag">
                  <span className="size-1.5 rounded-full bg-current" />
                  {checking ? "CHECKING" : degraded ? "DEGRADED" : "SYSTEM HEALTHY"}
                </span>
              </div>

              <div className="metrics-grid">
                <Card className="metric-card">
                  <div className="metric-top">
                    <span>API service</span>
                    <Activity size={18} className="text-cyan-300" />
                  </div>
                  <div className="metric-value">
                    {live.isPending ? "—" : live.isError ? "Offline" : "Online"}
                    <span className="mini-bars" aria-hidden="true">
                      {[12, 21, 16, 29, 23, 34, 29, 40, 35, 45].map((height, i) => (
                        <i key={i} style={{ height }} />
                      ))}
                    </span>
                  </div>
                  <div className="metric-footer">
                    <StatusLabel pending={live.isPending} error={live.isError} />
                    <span className="font-mono text-[10px]">/health/live</span>
                  </div>
                </Card>
                <Card className="metric-card violet">
                  <div className="metric-top">
                    <span>Metadata database</span>
                    <Database size={18} className="text-violet-300" />
                  </div>
                  <div className="metric-value">
                    {ready.isPending ? "—" : ready.isError ? "Not ready" : "Ready"}
                    <span className="database-art" aria-hidden="true">
                      <Database size={42} strokeWidth={1} />
                    </span>
                  </div>
                  <div className="metric-footer">
                    <StatusLabel pending={ready.isPending} error={ready.isError} />
                    <span className="font-mono text-[10px]">POSTGRESQL 17</span>
                  </div>
                </Card>
                <Card className="metric-card">
                  <div className="metric-top">
                    <span>Connected servers</span>
                    <Server size={18} className="text-slate-400" />
                  </div>
                  <div className="metric-value">
                    0<span className="metric-unit">servers</span>
                  </div>
                  <div className="metric-footer">
                    <span className="text-slate-400">Your fleet starts here</span>
                    <span className="neutral-pill">Not configured</span>
                  </div>
                </Card>
                <Card className="metric-card">
                  <div className="metric-top">
                    <span>Operations access</span>
                    <ShieldCheck size={18} className="text-slate-400" />
                  </div>
                  <div className="metric-value text-[28px]!">
                    Restricted
                    <LockKeyhole size={29} strokeWidth={1} className="text-slate-600" />
                  </div>
                  <div className="metric-footer">
                    <span className="text-slate-400">Foundation mode</span>
                    <span className="neutral-pill">Read only</span>
                  </div>
                </Card>
              </div>

              <div className="middle-grid">
                <Card className="topology-card">
                  <CardHeader>
                    <div>
                      <CardTitle>Control plane topology</CardTitle>
                      <p className="section-subtitle">A focused foundation. Built to expand.</p>
                    </div>
                    <span className="tiny-tag">
                      <span className="size-1.5 rounded-full bg-cyan-300" />
                      LOCAL
                    </span>
                  </CardHeader>
                  <CardContent>
                    <div
                      className="topology"
                      aria-label="Browser connects to Next.js, Next.js connects to FastAPI, FastAPI connects to PostgreSQL"
                    >
                      <div className="orbit orbit-one" />
                      <div className="orbit orbit-two" />
                      <div className="topology-node browser-node">
                        <Globe2 size={19} />
                        <span>
                          Browser<small>YOUR WORKSPACE</small>
                        </span>
                      </div>
                      <div className="topology-line line-one" />
                      <div className="topology-node web-node">
                        <Hexagon size={20} />
                        <span>
                          Next.js<small>WEB APPLICATION</small>
                        </span>
                        <span className="node-port">:18300</span>
                      </div>
                      <div className="topology-line line-two" />
                      <div className="topology-node api-node">
                        <Zap size={20} />
                        <span>
                          FastAPI<small>CONTROL PLANE API</small>
                        </span>
                        <span className="node-port">:18301</span>
                      </div>
                      <div className="topology-line line-three" />
                      <div className="topology-node db-node">
                        <Database size={20} />
                        <span>
                          PostgreSQL<small>METADATA DATABASE</small>
                        </span>
                        <span className="node-port">:18432</span>
                      </div>
                    </div>
                    <div className="topology-legend">
                      <span>
                        <i className="bg-cyan-300" />
                        Application layer
                      </span>
                      <span>
                        <i className="bg-violet-300" />
                        Data layer
                      </span>
                      <span className="ml-auto hidden sm:inline">Diagram / local architecture</span>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <div>
                      <CardTitle>Foundation checklist</CardTitle>
                      <p className="section-subtitle">The essentials, connected.</p>
                    </div>
                    <GitBranch size={17} className="text-slate-500" />
                  </CardHeader>
                  <CardContent>
                    <div className="checklist">
                      {[
                        {
                          title: "Application shell",
                          subtitle: "Next.js · App Router · TypeScript",
                          ready: true,
                        },
                        {
                          title: "API connectivity",
                          subtitle: "FastAPI · Structured health checks",
                          ready: live.isSuccess && !live.isError,
                        },
                        {
                          title: "Metadata persistence",
                          subtitle: "PostgreSQL 17 · SQLAlchemy · Alembic",
                          ready: ready.isSuccess && !ready.isError,
                        },
                        {
                          title: "Infrastructure access",
                          subtitle: "Reserved for a future phase",
                          ready: false,
                          locked: true,
                        },
                      ].map((item) => (
                        <div className="checklist-row" key={item.title}>
                          <span className={cn("check-icon", item.ready && "complete")}>
                            {item.locked ? (
                              <LockKeyhole size={14} />
                            ) : item.ready ? (
                              <Check size={14} />
                            ) : (
                              <Clock3 size={14} />
                            )}
                          </span>
                          <div>
                            <h3>{item.title}</h3>
                            <p>{item.subtitle}</p>
                          </div>
                          <span
                            className={cn(
                              "ml-auto text-[10px]",
                              item.ready ? "text-emerald-300" : "text-slate-500",
                            )}
                          >
                            {item.locked ? "PLANNED" : item.ready ? "READY" : "PENDING"}
                          </span>
                        </div>
                      ))}
                    </div>
                    <div className="isolation-note">
                      <ShieldCheck size={16} />
                      <p>
                        Isolated by design<span>No production infrastructure is connected.</span>
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div className="section-heading">
                <div>
                  <h2>Your infrastructure workspace</h2>
                  <p>One platform for every layer of your stack.</p>
                </div>
                <span className="planned-badge">6 planned modules</span>
              </div>
              <div className="modules-grid">
                {modules.map(({ name, icon: Icon, description }, i) => (
                  <button className="module-card group" key={name} onClick={() => selectView(name)}>
                    <div className="flex items-center justify-between">
                      <span className={cn("module-icon", i % 2 !== 0 && "purple")}>
                        <Icon size={20} />
                      </span>
                      <ArrowUpRight
                        size={17}
                        className="text-slate-600 transition-colors group-hover:text-cyan-200"
                      />
                    </div>
                    <h3>{name}</h3>
                    <p>{description}</p>
                    <span className="module-footer">
                      <span className="size-1 rounded-full bg-slate-500" />
                      Planned capability
                    </span>
                  </button>
                ))}
              </div>
              {(live.isError || ready.isError) && (
                <div className="connection-notice" role="status">
                  <CircleHelp size={16} />
                  <span>
                    {ready.isError ? ready.error.message : live.error?.message}
                    {ready.error instanceof ApiError && ready.error.correlationId
                      ? ` · Request ${ready.error.correlationId}`
                      : ""}
                  </span>
                </div>
              )}
            </>
          )}
          <footer className="page-footer">
            <span className="flex items-center gap-2">
              <Network size={13} />
              ZeaOPS<span className="text-slate-700">/</span>Local development
            </span>
            <span className="flex items-center gap-2">
              <Clock3 size={12} />
              {updated
                ? `Last healthy response ${new Date(updated).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}`
                : "Waiting for health response"}
              <ArrowDownLeft size={12} className="ml-2 text-cyan-300" />
            </span>
          </footer>
        </main>
      </div>
    </div>
  );
}
