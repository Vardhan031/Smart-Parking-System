import { useState, useEffect, useRef } from "react"
import {
    LogIn,
    LogOut,
    Camera,
    CheckCircle2,
    XCircle,
    ChevronDown,
    Loader2,
    Car,
    Clock,
    CreditCard,
    Hash,
    ScanLine,
    Trash2,
    Bike,
    AlertTriangle,
    FileText
} from "lucide-react"
import api from "../services/api"

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000/api"

export default function GateControl() {
    const [lots, setLots] = useState([])
    const [selectedLot, setSelectedLot] = useState(null)
    const [visible, setVisible] = useState(false)
    const [activityLog, setActivityLog] = useState([])

    useEffect(() => {
        fetchLots()
        setTimeout(() => setVisible(true), 100)
    }, [])

    const fetchLots = async () => {
        try {
            const res = await api.get("/admin/lots")
            const data = res.data.data || []
            setLots(data)
            if (data.length > 0) setSelectedLot(data[0])
        } catch (err) {
            console.error("Failed to fetch lots")
        }
    }

    const addLog = (entry) => {
        setActivityLog((prev) => [
            { ...entry, id: Date.now(), time: new Date() },
            ...prev
        ])
    }

    return (
        <div className="min-h-screen bg-[#0B1220] text-white px-10 py-8 relative overflow-hidden">

            {/* Background Glows */}
            <div className="absolute top-0 left-1/3 w-[800px] h-[800px] bg-indigo-600/10 blur-[120px] rounded-full"></div>
            <div className="absolute bottom-0 right-1/4 w-[600px] h-[600px] bg-cyan-500/10 blur-[120px] rounded-full"></div>

            <div
                className={`relative z-10 transition-all duration-700 ${visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
                    }`}
            >

                {/* Header */}
                <div className="flex justify-between items-start mb-10">
                    <div>
                        <h1 className="text-3xl font-semibold tracking-tight">
                            Gate Control
                        </h1>
                        <p className="text-neutral-400 mt-2">
                            Simulate ANPR entry & exit — upload vehicle images to trigger the parking flow
                        </p>
                    </div>
                </div>

                {/* Lot Selector */}
                <div className="mb-8">
                    <LotSelector
                        lots={lots}
                        selected={selectedLot}
                        onSelect={setSelectedLot}
                    />
                </div>

                {/* Gate Panels */}
                {selectedLot ? (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-12">
                        <GatePanel
                            type="entry"
                            lotId={selectedLot._id}
                            lotName={selectedLot.name}
                            onResult={addLog}
                        />
                        <GatePanel
                            type="exit"
                            lotId={selectedLot._id}
                            lotName={selectedLot.name}
                            onResult={addLog}
                        />
                    </div>
                ) : (
                    <div className="backdrop-blur-xl bg-white/[0.04] border border-white/10 rounded-2xl p-10 text-center text-neutral-400 mb-12">
                        No parking lots found. Create one first.
                    </div>
                )}

                {/* Activity Log */}
                <ActivityLog entries={activityLog} onClear={() => setActivityLog([])} />

            </div>
        </div>
    )
}


/* ============================================================
   LOT SELECTOR
   ============================================================ */

function LotSelector({ lots, selected, onSelect }) {
    const [open, setOpen] = useState(false)
    const ref = useRef(null)

    useEffect(() => {
        const handler = (e) => {
            if (ref.current && !ref.current.contains(e.target)) setOpen(false)
        }
        document.addEventListener("mousedown", handler)
        return () => document.removeEventListener("mousedown", handler)
    }, [])

    return (
        <div ref={ref} className="relative w-full max-w-md">
            <button
                onClick={() => setOpen((o) => !o)}
                className="
                    w-full flex items-center justify-between
                    backdrop-blur-xl bg-white/[0.06] border border-white/10
                    rounded-xl px-5 py-3 text-left
                    hover:bg-white/[0.08] transition cursor-pointer
                "
            >
                <div>
                    <p className="text-xs text-neutral-400 uppercase tracking-wide">
                        Parking Lot
                    </p>
                    <p className="text-sm font-medium mt-0.5">
                        {selected ? `${selected.name} (${selected.code})` : "Select a lot"}
                    </p>
                </div>
                <ChevronDown size={16} className={`text-neutral-400 transition-transform ${open ? "rotate-180" : ""}`} />
            </button>

            {open && (
                <div className="
                    absolute top-full left-0 right-0 mt-2 z-50
                    backdrop-blur-xl bg-[#111C2D] border border-white/10
                    rounded-xl shadow-2xl overflow-hidden
                ">
                    {lots.map((lot) => (
                        <button
                            key={lot._id}
                            onClick={() => { onSelect(lot); setOpen(false) }}
                            className={`
                                w-full px-5 py-3 text-left text-sm
                                hover:bg-white/10 transition cursor-pointer
                                ${selected?._id === lot._id ? "bg-white/5 text-indigo-400" : "text-neutral-300"}
                            `}
                        >
                            {lot.name} <span className="text-neutral-500 ml-1">({lot.code})</span>
                        </button>
                    ))}
                </div>
            )}
        </div>
    )
}


/* ============================================================
   GATE PANEL (Entry or Exit)
   ============================================================ */

function GatePanel({ type, lotId, lotName, onResult }) {
    const isEntry = type === "entry"
    const [file, setFile] = useState(null)
    const [preview, setPreview] = useState(null)
    const [loading, setLoading] = useState(false)
    const [result, setResult] = useState(null)
    const [vehicleType, setVehicleType] = useState("CAR")
    const fileInputRef = useRef(null)

    const handleFileChange = (e) => {
        const f = e.target.files?.[0]
        if (!f) return
        setFile(f)
        setPreview(URL.createObjectURL(f))
        setResult(null)
    }

    const handleSubmit = async () => {
        if (!file || !lotId) return
        setLoading(true)
        setResult(null)

        try {
            const formData = new FormData()
            formData.append("image", file)
            formData.append("lotId", lotId)
            if (isEntry) formData.append("vehicleType", vehicleType)

            const endpoint = isEntry ? "/api/anpr/entry" : "/api/anpr/exit"
            const response = await fetch(`${API_BASE.replace(/\/api$/, "")}${endpoint}`, {
                method: "POST",
                body: formData
            })

            const data = await response.json()

            setResult(data)
            onResult({
                type: isEntry ? "ENTRY" : "EXIT",
                success: data.success,
                plate: data.detection?.plate || "Unknown",
                message: data.message,
                slot: data.data?.slotNumber || null,
                fare: data.data?.fare ?? null,
                duration: data.data?.durationMinutes ?? null,
                payment: data.data?.paymentStatus || null,
                capturedAt: data.detection?.captured_at || null,
                lot: lotName
            })
        } catch (err) {
            const errResult = { success: false, message: err.message || "Request failed" }
            setResult(errResult)
            onResult({
                type: isEntry ? "ENTRY" : "EXIT",
                success: false,
                plate: "—",
                message: errResult.message,
                lot: lotName
            })
        } finally {
            setLoading(false)
        }
    }

    const reset = () => {
        setFile(null)
        setPreview(null)
        setResult(null)
        if (isEntry) setVehicleType("CAR")
        if (fileInputRef.current) fileInputRef.current.value = ""
    }

    const accentColor = isEntry ? "indigo" : "rose"
    const accentMap = {
        indigo: {
            border: "border-indigo-500/30",
            bg: "bg-indigo-500/10",
            text: "text-indigo-400",
            btn: "bg-indigo-600 hover:bg-indigo-500",
            glow: "bg-indigo-500/20"
        },
        rose: {
            border: "border-rose-500/30",
            bg: "bg-rose-500/10",
            text: "text-rose-400",
            btn: "bg-rose-600 hover:bg-rose-500",
            glow: "bg-rose-500/20"
        }
    }
    const a = accentMap[accentColor]

    return (
        <div className={`backdrop-blur-xl bg-white/[0.04] border border-white/10 rounded-2xl p-6 ${result?.success ? `ring-1 ${a.border}` : ""}`}>

            {/* Panel Header */}
            <div className="flex items-center gap-3 mb-6">
                <div className={`p-2.5 rounded-xl ${a.bg}`}>
                    {isEntry
                        ? <LogIn size={20} className={a.text} />
                        : <LogOut size={20} className={a.text} />
                    }
                </div>
                <div>
                    <h2 className="text-lg font-semibold">
                        {isEntry ? "Entry Gate" : "Exit Gate"}
                    </h2>
                    <p className="text-xs text-neutral-400">
                        {isEntry
                            ? "Upload vehicle image to register entry"
                            : "Upload vehicle image to process exit & fare"
                        }
                    </p>
                </div>
            </div>

            {/* Vehicle Type Selector (entry only) */}
            {isEntry && (
                <div className="flex gap-2 mb-5">
                    {["CAR", "BIKE"].map((vt) => (
                        <button
                            key={vt}
                            onClick={() => setVehicleType(vt)}
                            className={`
                                flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition cursor-pointer
                                ${vehicleType === vt
                                    ? `${a.btn} text-white`
                                    : "bg-white/5 border border-white/10 text-neutral-400 hover:bg-white/10"
                                }
                            `}
                        >
                            {vt === "CAR" ? <Car size={14} /> : <Bike size={14} />}
                            {vt}
                        </button>
                    ))}
                </div>
            )}

            {/* Image Upload Area */}
            <div
                className={`
                    relative border-2 border-dashed rounded-xl
                    flex items-center justify-center
                    transition-all duration-300 cursor-pointer
                    ${preview
                        ? "border-white/20 h-48"
                        : "border-white/10 hover:border-white/20 h-40"
                    }
                `}
                onClick={() => fileInputRef.current?.click()}
            >
                <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleFileChange}
                    className="hidden"
                />

                {preview ? (
                    <img
                        src={preview}
                        alt="Vehicle"
                        className="h-full w-full object-contain rounded-xl"
                    />
                ) : (
                    <div className="text-center">
                        <Camera size={32} className="mx-auto text-neutral-500 mb-2" />
                        <p className="text-sm text-neutral-400">
                            Click to upload vehicle image
                        </p>
                        <p className="text-xs text-neutral-500 mt-1">
                            JPG, PNG — max 10 MB
                        </p>
                    </div>
                )}
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3 mt-5">
                <button
                    onClick={handleSubmit}
                    disabled={!file || loading}
                    className={`
                        flex-1 flex items-center justify-center gap-2
                        px-4 py-3 rounded-xl font-medium text-sm
                        text-white transition-all
                        disabled:opacity-30 disabled:cursor-not-allowed
                        cursor-pointer
                        ${a.btn}
                    `}
                >
                    {loading ? (
                        <>
                            <Loader2 size={16} className="animate-spin" />
                            Detecting...
                        </>
                    ) : (
                        <>
                            <ScanLine size={16} />
                            {isEntry ? "Scan & Enter" : "Scan & Exit"}
                        </>
                    )}
                </button>

                {(file || result) && (
                    <button
                        onClick={reset}
                        className="
                            px-4 py-3 rounded-xl text-sm
                            bg-white/5 border border-white/10
                            hover:bg-white/10 transition cursor-pointer
                            text-neutral-400
                        "
                    >
                        Reset
                    </button>
                )}
            </div>

            {/* Result Display */}
            {result && (
                <div className={`mt-5 rounded-xl p-4 ${result.success ? "bg-emerald-500/10 border border-emerald-500/20" : "bg-rose-500/10 border border-rose-500/20"}`}>

                    <div className="flex items-center gap-2 mb-3">
                        {result.success
                            ? <CheckCircle2 size={18} className="text-emerald-400" />
                            : <XCircle size={18} className="text-rose-400" />
                        }
                        <span className={`text-sm font-semibold ${result.success ? "text-emerald-400" : "text-rose-400"}`}>
                            {result.message}
                        </span>
                    </div>

                    {result.detection && (
                        <div className="space-y-2 text-sm">
                            <ResultRow icon={Car} label="Plate Detected" value={result.detection.plate} />
                            {result.detection.confidence != null && (
                                <ResultRow icon={ScanLine} label="Confidence" value={`${(result.detection.confidence * 100).toFixed(1)}%`} />
                            )}
                            {result.detection.captured_at ? (
                                <ResultRow
                                    icon={Clock}
                                    label="Camera Timestamp"
                                    value={new Date(result.detection.captured_at).toLocaleString([], {
                                        year: "numeric", month: "2-digit", day: "2-digit",
                                        hour: "2-digit", minute: "2-digit", second: "2-digit"
                                    })}
                                />
                            ) : (
                                <ResultRow icon={Clock} label="Camera Timestamp" value="Not found — using current time" />
                            )}
                        </div>
                    )}

                    {result.data && (
                        <div className="space-y-2 text-sm mt-2 pt-2 border-t border-white/10">
                            {result.data.slotNumber != null && (
                                <ResultRow icon={Hash} label="Slot Assigned" value={`#${result.data.slotNumber}`} highlight />
                            )}
                            {result.data.durationMinutes != null && (
                                <ResultRow icon={Clock} label="Duration" value={`${result.data.durationMinutes} min`} />
                            )}
                            {result.data.fare != null && (
                                <ResultRow icon={CreditCard} label="Fare" value={`₹${result.data.fare}`} highlight />
                            )}
                            {result.data.paymentStatus && (
                                <ResultRow
                                    icon={CreditCard}
                                    label="Payment"
                                    value={result.data.paymentStatus}
                                    highlight={result.data.paymentStatus === "PAID"}
                                />
                            )}
                        </div>
                    )}

                    {/* OCR Debug Panel — shown when no valid plate was found */}
                    {!result.success && result.debug_rejections?.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-white/10">
                            <div className="flex items-center gap-1.5 mb-2">
                                <AlertTriangle size={13} className="text-amber-400" />
                                <span className="text-xs font-semibold text-amber-400 uppercase tracking-wide">
                                    Model saw {result.debug_rejections.length} region(s) — OCR output:
                                </span>
                            </div>
                            <div className="space-y-1.5">
                                {result.debug_rejections.map((r, i) => (
                                    <div key={i} className="flex items-start gap-2 text-xs">
                                        <FileText size={12} className="text-neutral-500 mt-0.5 shrink-0" />
                                        <div className="flex-1 min-w-0">
                                            <span className="font-mono text-amber-300/90">
                                                {r.raw_text ? `"${r.raw_text}"` : "(empty)"}
                                            </span>
                                            <span className="text-neutral-500 ml-2">
                                                {r.status === "FORMAT_REJECTED"
                                                    ? "→ not a valid plate format"
                                                    : "→ OCR returned no text"}
                                            </span>
                                            <span className="text-neutral-600 ml-2">
                                                conf {(r.confidence * 100).toFixed(0)}%
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {!result.success && (!result.debug_rejections || result.debug_rejections.length === 0) && !result.detection && (
                        <p className="mt-2 text-xs text-neutral-500">
                            YOLO found no plate regions in this image.
                        </p>
                    )}
                </div>
            )}
        </div>
    )
}


/* ============================================================
   RESULT ROW
   ============================================================ */

function ResultRow({ icon: Icon, label, value, highlight }) {
    return (
        <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-neutral-400">
                <Icon size={14} />
                <span>{label}</span>
            </div>
            <span className={`font-medium ${highlight ? "text-white" : "text-neutral-300"}`}>
                {value}
            </span>
        </div>
    )
}


/* ============================================================
   ACTIVITY LOG
   ============================================================ */

function ActivityLog({ entries, onClear }) {
    if (entries.length === 0) return null

    return (
        <div>
            <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold">Gate Activity Log</h2>
                <button
                    onClick={onClear}
                    className="flex items-center gap-1.5 text-xs text-neutral-400 hover:text-white transition cursor-pointer"
                >
                    <Trash2 size={12} />
                    Clear
                </button>
            </div>

            <div className="backdrop-blur-xl bg-white/[0.04] border border-white/10 rounded-2xl overflow-hidden">
                {entries.map((entry, i) => (
                    <div
                        key={entry.id}
                        className={`flex items-center gap-4 px-6 py-4 ${i !== entries.length - 1 ? "border-b border-white/5" : ""
                            }`}
                    >
                        {/* Type Badge */}
                        <div className={`
                            px-3 py-1 rounded-lg text-xs font-semibold uppercase tracking-wide
                            ${entry.type === "ENTRY"
                                ? "bg-indigo-500/20 text-indigo-400"
                                : "bg-rose-500/20 text-rose-400"
                            }
                        `}>
                            {entry.type}
                        </div>

                        {/* Status */}
                        <div className={`w-2 h-2 rounded-full ${entry.success ? "bg-emerald-400" : "bg-rose-400"}`} />

                        {/* Details */}
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">
                                <span className="text-white">{entry.plate}</span>
                                <span className="text-neutral-500 mx-2">•</span>
                                <span className="text-neutral-400">{entry.lot}</span>
                                {entry.slot && (
                                    <>
                                        <span className="text-neutral-500 mx-2">•</span>
                                        <span className="text-neutral-400">Slot #{entry.slot}</span>
                                    </>
                                )}
                                {entry.fare != null && (
                                    <>
                                        <span className="text-neutral-500 mx-2">•</span>
                                        <span className="text-emerald-400">₹{entry.fare}</span>
                                    </>
                                )}
                                {entry.payment && (
                                    <>
                                        <span className="text-neutral-500 mx-2">•</span>
                                        <span className={
                                            entry.payment === "PAID" ? "text-emerald-400" :
                                                entry.payment === "UNPAID" ? "text-amber-400" : "text-neutral-400"
                                        }>
                                            {entry.payment}
                                        </span>
                                    </>
                                )}
                            </p>
                            <p className="text-xs text-neutral-500 mt-0.5">
                                {entry.message}
                            </p>
                        </div>

                        {/* Timestamp — prefer camera time, fall back to log time */}
                        <div className="text-right">
                            {entry.capturedAt ? (
                                <>
                                    <p className="text-xs text-cyan-400 whitespace-nowrap">
                                        {new Date(entry.capturedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                                    </p>
                                    <p className="text-[10px] text-neutral-600 whitespace-nowrap">cam time</p>
                                </>
                            ) : (
                                <p className="text-xs text-neutral-500 whitespace-nowrap">
                                    {entry.time.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                                </p>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    )
}
