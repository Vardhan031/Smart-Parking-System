import {
    Building2,
    LayoutGrid,
    Car,
    ShieldCheck,
    ArrowUpRight,
    ArrowDownRight,
    TrendingUp,
    Zap,
    BarChart3
} from "lucide-react"
import api from "../services/api"
import { useEffect, useRef, useState } from "react"

export default function Dashboard() {
    const [data, setData] = useState(null)

    useEffect(() => {
        fetchOverview()
    }, [])

    const fetchOverview = async () => {
        const res = await api.get("/dashboard/overview")
        setData(res.data.data)
    }

    if (!data) return null

    const available = data.totalSlots - data.totalOccupied
    const percent = data.utilizationPercentage

    return (
        <div className="min-h-screen bg-[#0B1220] text-white px-10 py-8 relative overflow-hidden">

            {/* BACKGROUND GLOWS */}
            <div className="absolute top-0 left-1/3 w-[800px] h-[800px] bg-indigo-600/10 blur-[120px] rounded-full"></div>
            <div className="absolute bottom-0 right-1/4 w-[600px] h-[600px] bg-cyan-500/10 blur-[120px] rounded-full"></div>

            {/* HEADER */}
            <div className="flex justify-between items-center mb-10 relative z-10">
                <div>
                    <h1 className="text-3xl font-semibold">Dashboard</h1>
                    <p className="text-neutral-400 mt-1">
                        Real-time monitoring • {data.totalLots} lots active
                    </p>
                </div>
            </div>

            {/* HERO SECTION */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 relative z-10">

                <div className="lg:col-span-2 glass-card p-8">

                    <p className="text-sm text-indigo-400 uppercase tracking-wide">
                        System Utilization
                    </p>

                    <div className="flex justify-between items-center mt-6">

                        <div>
                            <h2 className="text-6xl font-semibold">
                                {percent}%
                            </h2>
                            <p className="text-neutral-400 mt-2">
                                {data.totalOccupied} of {data.totalSlots} slots occupied
                            </p>
                        </div>

                        <DonutChart percent={percent} available={available} />
                    </div>

                    <div className="mt-8">
                        <div className="w-full h-3 bg-[#1E293B] rounded-full overflow-hidden">
                            <div
                                className="h-full bg-gradient-to-r from-indigo-500 via-blue-500 to-cyan-400 transition-all duration-1000"
                                style={{ width: `${percent}%` }}
                            />
                        </div>
                    </div>
                </div>

                {/* RIGHT STACK */}
                <div className="space-y-6">

                    <SideMetric icon={TrendingUp} value={`${data.vsYesterday >= 0 ? "+" : ""}${data.vsYesterday}%`} label="vs yesterday" color="text-emerald-400" />
                    <SideMetric icon={Zap} value={`${data.avgParkTime} min`} label="Avg park time" color="text-indigo-400" />
                    <SideMetric icon={BarChart3} value={`$${(data.todayRevenue ?? 0).toLocaleString()}`} label="Today's revenue" color="text-cyan-400" />

                </div>
            </div>

            {/* KPI GRID */}
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-6 mt-12 relative z-10">

                <KPI title="Total Lots" value={data.totalLots} icon={Building2} trend="+1" color="indigo" />
                <KPI title="Total Slots" value={data.totalSlots} icon={LayoutGrid} trend="+12" color="blue" />
                <KPI title="Occupied" value={data.totalOccupied} icon={Car} trend="+3" color="amber" />
                <KPI title="Active Vehicles" value={data.activeSessions} icon={ShieldCheck} trend="-2" positive={false} color="emerald" />
                <KPI title="Today's Entries" value={data.todayEntries} icon={ArrowUpRight} trend="+18" color="blue" />
                <KPI title="Today's Exits" value={data.todayExits} icon={ArrowDownRight} trend="+11" color="rose" />


            </div>

            {/* LOWER SECTION */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-12 relative z-10">
                <RecentActivity items={data.recentActivity} />
                <LotBreakdown lots={data.lotBreakdown} />
            </div>

        </div>
    )
}

/* ---------- GLASS KPI CARD ---------- */



function KPI({
    title,
    value,
    icon: Icon,
    trend = "+0",
    positive = true,
    color = "indigo"
}) {
    const cardRef = useRef(null)
    const [displayValue, setDisplayValue] = useState(0)

    /* ---------------------------
       1️⃣ Smooth Number Counter
    ----------------------------*/
    useEffect(() => {
        let start = 0
        const end = Number(value)
        if (isNaN(end)) return

        const duration = 1200
        const increment = end / (duration / 16)

        const counter = setInterval(() => {
            start += increment
            if (start >= end) {
                start = end
                clearInterval(counter)
            }
            setDisplayValue(Math.floor(start))
        }, 16)

        return () => clearInterval(counter)
    }, [value])

    /* ---------------------------
       2️⃣ Mouse Glow + 3D Tilt
    ----------------------------*/
    const handleMouseMove = (e) => {
        const card = cardRef.current
        const rect = card.getBoundingClientRect()

        const x = e.clientX - rect.left
        const y = e.clientY - rect.top

        const centerX = rect.width / 2
        const centerY = rect.height / 2

        const rotateX = ((y - centerY) / centerY) * 6
        const rotateY = ((x - centerX) / centerX) * -6

        card.style.transform = `rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale(1.03)`
        card.style.setProperty("--mouse-x", `${x}px`)
        card.style.setProperty("--mouse-y", `${y}px`)
    }

    const resetTilt = () => {
        const card = cardRef.current
        card.style.transform = "rotateX(0deg) rotateY(0deg) scale(1)"
    }

    /* ---------------------------
       Color Variants
    ----------------------------*/
    const colorMap = {
        indigo: "from-indigo-500/30 to-indigo-500/5 text-indigo-400",
        blue: "from-blue-500/30 to-blue-500/5 text-blue-400",
        amber: "from-amber-500/30 to-amber-500/5 text-amber-400",
        emerald: "from-emerald-500/30 to-emerald-500/5 text-emerald-400",
        rose: "from-rose-500/30 to-rose-500/5 text-rose-400",
    }

    return (
        <div
            ref={cardRef}
            onMouseMove={handleMouseMove}
            onMouseLeave={resetTilt}
            className="
        relative
        group
        overflow-hidden
        rounded-2xl
        p-6
        backdrop-blur-2xl
        bg-white/[0.04]
        border border-white/10
        transition-all duration-300 ease-out
        will-change-transform
      "
            style={{
                transformStyle: "preserve-3d"
            }}
        >
            {/* 3️⃣ Mouse Follow Glow */}
            <div
                className="
          pointer-events-none
          absolute inset-0
          opacity-0 group-hover:opacity-100
          transition duration-300
        "
                style={{
                    background:
                        "radial-gradient(circle at var(--mouse-x) var(--mouse-y), rgba(99,102,241,0.25), transparent 60%)"
                }}
            />

            {/* 4️⃣ Moving Shimmer */}
            <div className="
        absolute inset-0
        opacity-0 group-hover:opacity-100
        transition duration-700
      ">
                <div className="
          absolute -left-1/2 top-0 h-full w-1/2
          bg-gradient-to-r from-transparent via-white/10 to-transparent
          skew-x-[-20deg]
          group-hover:animate-shimmer
        " />
            </div>

            {/* 5️⃣ Animated Border Highlight */}
            <div className="
        absolute inset-0
        rounded-2xl
        border border-transparent
        group-hover:border-indigo-400/40
        transition duration-500
      " />

            {/* CONTENT */}
            <div className="relative z-10">

                {/* TOP ROW */}
                <div className="flex justify-between items-start">

                    {/* ICON */}
                    <div className={`
            p-3 rounded-xl
            bg-gradient-to-br ${colorMap[color]}
            backdrop-blur-md
            border border-white/10
            transition-all duration-500
            group-hover:scale-110
          `}>
                        <Icon size={18} />
                    </div>

                    {/* TREND BADGE */}
                    <div
                        className={`
              text-xs px-2 py-1 rounded-full
              backdrop-blur-md
              border border-white/10
              transition-all duration-300
              ${positive
                                ? "bg-emerald-500/15 text-emerald-400"
                                : "bg-rose-500/15 text-rose-400"}
            `}
                    >
                        {positive ? "↗" : "↘"} {trend}
                    </div>

                </div>

                {/* VALUE */}
                <h3 className="
          text-4xl font-semibold mt-8 tracking-tight
          transition-all duration-300
          group-hover:translate-y-[-3px]
        ">
                    {displayValue}
                </h3>

                {/* LABEL */}
                <p className="text-sm text-neutral-400 mt-2">
                    {title}
                </p>

            </div>
        </div>
    )
}




/* ---------- DONUT ---------- */

function DonutChart({ percent, available }) {
    const radius = 60
    const circumference = 2 * Math.PI * radius
    const offset = circumference - (percent / 100) * circumference

    return (
        <div className="relative w-40 h-40">

            <svg width="160" height="160" className="transform -rotate-90">
                <circle cx="80" cy="80" r={radius}
                    stroke="#1E293B"
                    strokeWidth="12"
                    fill="transparent"
                />
                <circle
                    cx="80"
                    cy="80"
                    r={radius}
                    stroke="url(#gradient)"
                    strokeWidth="12"
                    fill="transparent"
                    strokeDasharray={circumference}
                    strokeDashoffset={offset}
                    strokeLinecap="round"
                    className="transition-all duration-1000 ease-out"
                />
                <defs>
                    <linearGradient id="gradient">
                        <stop offset="0%" stopColor="#6366F1" />
                        <stop offset="100%" stopColor="#22D3EE" />
                    </linearGradient>
                </defs>
            </svg>

            <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-xl font-semibold">{available}</span>
                <span className="text-xs text-neutral-400">Free</span>
            </div>
        </div>
    )
}

/* ---------- SIDE METRIC ---------- */

function SideMetric({ icon: Icon, value, label, color }) {
    return (
        <div className="
      backdrop-blur-xl
      bg-white/5
      border border-white/10
      rounded-2xl
      p-6
      flex items-center gap-4
      transition duration-500
      hover:bg-white/10
    ">
            <div className={`p-3 rounded-xl bg-white/5 ${color}`}>
                <Icon size={18} />
            </div>
            <div>
                <p className={`text-lg font-semibold ${color}`}>{value}</p>
                <p className="text-sm text-neutral-400">{label}</p>
            </div>
        </div>
    )
}

/* ---------- RECENT ACTIVITY ---------- */

function RecentActivity({ items = [] }) {
    return (
        <div className="glass-card p-6">
            <div className="flex justify-between items-center mb-6">
                <h3 className="text-lg font-medium">Recent Activity</h3>
                <span className="text-xs bg-emerald-500/15 text-emerald-400 px-2 py-1 rounded-full">
                    Live
                </span>
            </div>

            <div className="space-y-4">
                {items.length > 0 ? (
                    items.map((item, i) => (
                        <ActivityItem key={i} plate={item.plate} lot={item.lot} type={item.type} />
                    ))
                ) : (
                    <p className="text-sm text-neutral-400">No recent activity</p>
                )}
            </div>
        </div>
    )
}

function ActivityItem({ plate, lot, type }) {
    return (
        <div className="flex justify-between items-center border-b border-white/10 pb-3">
            <div>
                <p className="font-medium">{plate}</p>
                <p className="text-xs text-neutral-400">{lot}</p>
            </div>

            <span
                className={`text-xs px-2 py-1 rounded-full
          ${type === "Entry"
                        ? "bg-emerald-500/15 text-emerald-400"
                        : "bg-rose-500/15 text-rose-400"}
        `}
            >
                {type}
            </span>
        </div>
    )
}

/* ---------- LOT BREAKDOWN ---------- */

function LotBreakdown({ lots = [] }) {
    return (
        <div className="glass-card p-6">
            <h3 className="text-lg font-medium mb-6">Lot Breakdown</h3>

            <div className="space-y-5">
                {lots.length > 0 ? (
                    lots.map((lot, i) => {
                        const percent = lot.total > 0 ? Math.round((lot.used / lot.total) * 100) : 0

                        return (
                            <div key={i}>
                                <div className="flex justify-between text-sm text-neutral-400 mb-2">
                                    <span>{lot.name}</span>
                                    <span>{lot.used}/{lot.total} ({percent}%)</span>
                                </div>

                                <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-gradient-to-r from-indigo-500 to-cyan-400 transition-all duration-1000"
                                        style={{ width: `${percent}%` }}
                                    />
                                </div>
                            </div>
                        )
                    })
                ) : (
                    <p className="text-sm text-neutral-400">No lots available</p>
                )}
            </div>
        </div>
    )
}

