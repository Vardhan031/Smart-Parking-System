import { useState } from "react"
import { User, Shield, Server, ChevronRight, Eye, EyeOff } from "lucide-react"
import api from "../services/api"

const SECTIONS = [
    { id: "account", label: "Account", icon: User, desc: "Profile & preferences" },
    { id: "security", label: "Security", icon: Shield, desc: "Password & session" },
    { id: "system", label: "System", icon: Server, desc: "API & diagnostics" },
]

export default function Settings() {
    const [active, setActive] = useState("account")

    return (
        <div className="px-10 py-8 min-h-screen relative overflow-hidden">

            {/* Glows */}
            <div className="absolute top-0 left-1/3 w-[700px] h-[700px] bg-indigo-600/10 blur-[120px] rounded-full pointer-events-none" />
            <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-cyan-500/10 blur-[120px] rounded-full pointer-events-none" />

            <div className="relative z-10">

                {/* Header */}
                <div className="mb-10">
                    <h1 className="text-3xl font-semibold tracking-tight text-white">Settings</h1>
                    <p className="text-neutral-400 mt-2">Manage your account and system preferences</p>
                </div>

                <div className="flex gap-8">

                    {/* Left nav */}
                    <div className="w-52 shrink-0">
                        <nav className="space-y-1">
                            {SECTIONS.map((s) => (
                                <button
                                    key={s.id}
                                    onClick={() => setActive(s.id)}
                                    className={`
                                        w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left
                                        transition-all duration-200 cursor-pointer
                                        ${active === s.id
                                            ? "bg-indigo-500/10 border border-indigo-500/20 text-white"
                                            : "text-neutral-400 hover:bg-white/[0.04] hover:text-neutral-200 border border-transparent"
                                        }
                                    `}
                                >
                                    <s.icon
                                        size={15}
                                        className={`shrink-0 ${active === s.id ? "text-indigo-400" : "text-neutral-500"}`}
                                    />
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium leading-none">{s.label}</p>
                                        <p className="text-[10px] text-neutral-500 mt-0.5">{s.desc}</p>
                                    </div>
                                    {active === s.id && (
                                        <ChevronRight size={13} className="text-indigo-400 shrink-0" />
                                    )}
                                </button>
                            ))}
                        </nav>
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                        {active === "account" && <AccountSection />}
                        {active === "security" && <SecuritySection />}
                        {active === "system" && <SystemSection />}
                    </div>

                </div>
            </div>
        </div>
    )
}

/* -------- Account -------- */

function AccountSection() {
    const [prefs, setPrefs] = useState({
        autoRefresh: true,
        sessionAlerts: false,
        compactView: false,
    })

    return (
        <div className="space-y-5">
            <SectionCard title="Profile" subtitle="Your admin account information">
                <div className="flex items-center gap-4 mb-6">
                    <div className="w-12 h-12 rounded-2xl bg-indigo-600/30 border border-indigo-500/30 flex items-center justify-center text-lg font-semibold text-indigo-300 shrink-0">
                        A
                    </div>
                    <div>
                        <p className="font-semibold text-white">Admin</p>
                        <p className="text-sm text-neutral-400">System Administrator</p>
                    </div>
                </div>
                <div className="space-y-1">
                    <InfoRow label="Role" value="ADMIN" badge />
                    <InfoRow label="Access Level" value="Full system access" />
                    <InfoRow label="Portal" value="SmartPark Admin" />
                </div>
            </SectionCard>

            <SectionCard title="Preferences" subtitle="Display and notification settings">
                <div className="space-y-4">
                    <Toggle
                        label="Dashboard auto-refresh"
                        desc="Refresh stats every 30 seconds"
                        checked={prefs.autoRefresh}
                        onChange={(v) => setPrefs((p) => ({ ...p, autoRefresh: v }))}
                    />
                    <Toggle
                        label="Session alerts"
                        desc="Notify on new parking activity"
                        checked={prefs.sessionAlerts}
                        onChange={(v) => setPrefs((p) => ({ ...p, sessionAlerts: v }))}
                    />
                    <Toggle
                        label="Compact sidebar"
                        desc="Use narrower navigation layout"
                        checked={prefs.compactView}
                        onChange={(v) => setPrefs((p) => ({ ...p, compactView: v }))}
                    />
                </div>
            </SectionCard>
        </div>
    )
}

/* -------- Security -------- */

function SecuritySection() {
    const [form, setForm] = useState({ current: "", newPass: "", confirm: "" })
    const [showCurrent, setShowCurrent] = useState(false)
    const [showNew, setShowNew] = useState(false)
    const [status, setStatus] = useState(null)
    const [message, setMessage] = useState("")
    const [loading, setLoading] = useState(false)

    const handleSubmit = async (e) => {
        e.preventDefault()
        if (form.newPass !== form.confirm) {
            setStatus("error")
            setMessage("New passwords don't match.")
            return
        }
        if (form.newPass.length < 6) {
            setStatus("error")
            setMessage("Password must be at least 6 characters.")
            return
        }
        setLoading(true)
        setStatus(null)
        try {
            await api.put("/auth/change-password", {
                currentPassword: form.current,
                newPassword: form.newPass,
            })
            setStatus("success")
            setMessage("Password updated successfully.")
            setForm({ current: "", newPass: "", confirm: "" })
        } catch (err) {
            setStatus("error")
            setMessage(err.response?.data?.message || "Failed to update password.")
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="space-y-5">
            <SectionCard title="Change Password" subtitle="Update your admin account password">
                <form onSubmit={handleSubmit} className="space-y-4">
                    <PassField
                        label="Current Password"
                        value={form.current}
                        show={showCurrent}
                        onToggle={() => setShowCurrent((s) => !s)}
                        onChange={(v) => setForm((f) => ({ ...f, current: v }))}
                    />
                    <PassField
                        label="New Password"
                        value={form.newPass}
                        show={showNew}
                        onToggle={() => setShowNew((s) => !s)}
                        onChange={(v) => setForm((f) => ({ ...f, newPass: v }))}
                    />
                    <PassField
                        label="Confirm New Password"
                        value={form.confirm}
                        show={showNew}
                        onToggle={() => setShowNew((s) => !s)}
                        onChange={(v) => setForm((f) => ({ ...f, confirm: v }))}
                    />

                    {status && (
                        <div className={`px-4 py-3 rounded-xl text-sm border ${
                            status === "success"
                                ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                                : "bg-rose-500/10 border-rose-500/20 text-rose-400"
                        }`}>
                            {message}
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={loading}
                        className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                    >
                        {loading ? "Updating..." : "Update Password"}
                    </button>
                </form>
            </SectionCard>

            <SectionCard title="Active Session" subtitle="Current login session status">
                <div className="flex items-center gap-3 px-4 py-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
                    <div>
                        <p className="text-sm font-medium text-emerald-400">Session Active</p>
                        <p className="text-xs text-neutral-400 mt-0.5">Authenticated as Admin</p>
                    </div>
                </div>
            </SectionCard>
        </div>
    )
}

/* -------- System -------- */

function SystemSection() {
    const apiBase = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000/api"

    return (
        <div className="space-y-5">
            <SectionCard title="Application Info" subtitle="Frontend and backend details">
                <div className="space-y-1">
                    <InfoRow label="Application" value="SmartPark Admin Portal" />
                    <InfoRow label="API Base URL" value={apiBase} mono />
                    <InfoRow label="Frontend" value="React 19 + Vite 7" />
                    <InfoRow label="UI" value="Tailwind CSS v4 + shadcn/ui" />
                    <InfoRow label="Auth" value="JWT (role-based)" />
                </div>
            </SectionCard>

            <SectionCard title="Services" subtitle="Configured microservices">
                <div className="space-y-2">
                    <ServiceRow name="Express Backend" endpoint={apiBase.replace("/api", "")} status="configured" />
                    <ServiceRow name="ANPR Service" endpoint="http://localhost:8000" status="configured" />
                    <ServiceRow name="MongoDB" endpoint="via MONGO_URI env var" status="env" />
                </div>
            </SectionCard>
        </div>
    )
}

/* -------- Shared sub-components -------- */

function SectionCard({ title, subtitle, children }) {
    return (
        <div className="backdrop-blur-xl bg-white/[0.04] border border-white/10 rounded-2xl p-6">
            <div className="mb-5">
                <h3 className="text-sm font-semibold text-white">{title}</h3>
                <p className="text-xs text-neutral-500 mt-0.5">{subtitle}</p>
            </div>
            <div className="border-t border-white/[0.06] pt-5">
                {children}
            </div>
        </div>
    )
}

function InfoRow({ label, value, badge, mono }) {
    return (
        <div className="flex items-center justify-between py-2.5 border-b border-white/[0.04] last:border-0">
            <span className="text-[10px] font-medium text-neutral-500 uppercase tracking-wider w-32 shrink-0">{label}</span>
            {badge ? (
                <span className="text-xs px-2.5 py-1 bg-indigo-500/15 border border-indigo-500/20 text-indigo-400 rounded-full font-medium">
                    {value}
                </span>
            ) : (
                <span className={`text-sm text-neutral-200 text-right ${mono ? "font-mono text-xs" : ""}`}>{value}</span>
            )}
        </div>
    )
}

function Toggle({ label, desc, checked, onChange }) {
    return (
        <div className="flex items-center justify-between">
            <div>
                <p className="text-sm text-neutral-200">{label}</p>
                <p className="text-xs text-neutral-500 mt-0.5">{desc}</p>
            </div>
            <button
                type="button"
                onClick={() => onChange(!checked)}
                className={`relative w-9 h-5 rounded-full transition-all duration-300 cursor-pointer shrink-0 ${
                    checked ? "bg-indigo-600" : "bg-white/10"
                }`}
            >
                <span
                    className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-all duration-300 ${
                        checked ? "translate-x-4" : ""
                    }`}
                />
            </button>
        </div>
    )
}

function PassField({ label, value, show, onToggle, onChange }) {
    return (
        <div className="space-y-1.5">
            <label className="text-[10px] font-medium text-neutral-400 uppercase tracking-widest">{label}</label>
            <div className="relative">
                <input
                    type={show ? "text" : "password"}
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    required
                    className="
                        w-full px-4 py-3 pr-11 text-sm text-white
                        bg-white/[0.04] border border-white/[0.08] rounded-xl
                        outline-none
                        focus:border-indigo-500/60 focus:ring-1 focus:ring-indigo-500/20
                        transition-all duration-200
                    "
                />
                <button
                    type="button"
                    onClick={onToggle}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-neutral-300 transition-colors"
                >
                    {show ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
            </div>
        </div>
    )
}

function ServiceRow({ name, endpoint, status }) {
    return (
        <div className="flex items-center justify-between px-4 py-3 bg-white/[0.03] border border-white/[0.06] rounded-xl">
            <div className="min-w-0">
                <p className="text-sm font-medium text-neutral-200">{name}</p>
                <p className="text-xs text-neutral-500 font-mono mt-0.5 truncate">{endpoint}</p>
            </div>
            <div className={`flex items-center gap-1.5 text-xs ml-4 shrink-0 ${
                status === "env" ? "text-amber-400" : "text-neutral-400"
            }`}>
                <span className={`w-1.5 h-1.5 rounded-full ${
                    status === "env" ? "bg-amber-400" : "bg-neutral-500"
                }`} />
                {status === "env" ? "via env" : "configured"}
            </div>
        </div>
    )
}
