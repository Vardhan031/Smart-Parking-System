import { useEffect, useState } from "react"

function StatCard({ label, value }) {
    const [displayValue, setDisplayValue] = useState(0)

    useEffect(() => {
        let start = 0
        const end = Number(value)
        if (isNaN(end)) return

        const duration = 800
        const startTime = performance.now()

        const animate = (time) => {
            const progress = Math.min((time - startTime) / duration, 1)
            const eased = 1 - Math.pow(1 - progress, 3)
            setDisplayValue(Math.floor(eased * end))
            if (progress < 1) requestAnimationFrame(animate)
        }

        requestAnimationFrame(animate)
    }, [value])

    return (
        <div className="
            relative
            group
            overflow-hidden
            backdrop-blur-xl
            bg-white/[0.04]
            border border-white/10
            rounded-2xl
            p-6
            transition-all duration-500
            hover:bg-white/[0.06]
            hover:border-white/20
            hover:shadow-[0_20px_50px_rgba(0,0,0,0.6)]
        ">

            {/* Soft Hover Glow */}
            <div className="
                absolute inset-0
                opacity-0 group-hover:opacity-100
                transition duration-500
                bg-gradient-to-br from-indigo-600/10 via-transparent to-cyan-500/10
            " />

            <div className="relative z-10">

                <p className="
                    text-xs
                    text-neutral-400
                    uppercase
                    tracking-widest
                ">
                    {label}
                </p>

                <p className="
                    text-3xl
                    font-semibold
                    text-white
                    mt-3
                    tracking-tight
                    transition-all duration-300
                    group-hover:translate-y-[-2px]
                ">
                    {typeof value === "number"
                        ? displayValue.toLocaleString()
                        : value}
                </p>

            </div>
        </div>
    )
}

export default function StatsRow({
    totalLots,
    activeLots,
    totalSlots,
    occupiedSlots,
}) {
    return (
        <div className="
            grid
            grid-cols-1
            sm:grid-cols-2
            xl:grid-cols-4
            gap-6
            mb-10
        ">
            <StatCard label="Total Lots" value={totalLots} />
            <StatCard label="Active Lots" value={activeLots} />
            <StatCard label="Total Slots" value={totalSlots} />
            <StatCard label="Occupied Slots" value={occupiedSlots} />
        </div>
    )
}
