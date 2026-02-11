import { useNavigate } from "react-router-dom"
import { MapPin, MoreVertical } from "lucide-react"
import { useRef } from "react"
import ProgressBar from "./ProgressBar"

export default function ParkingLotCard({ lot }) {
    const navigate = useNavigate()
    const cardRef = useRef(null)

    if (!lot) return null

    const occupancy = lot.occupancyPercentage || 0

    /* Subtle 3D Tilt */
    const handleMouseMove = (e) => {
        const card = cardRef.current
        const rect = card.getBoundingClientRect()

        const x = e.clientX - rect.left
        const y = e.clientY - rect.top

        const centerX = rect.width / 2
        const centerY = rect.height / 2

        const rotateX = ((y - centerY) / centerY) * 3
        const rotateY = ((x - centerX) / centerX) * -3

        card.style.transform =
            `perspective(800px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale(1.02)`
    }

    const resetTilt = () => {
        const card = cardRef.current
        card.style.transform =
            "perspective(800px) rotateX(0deg) rotateY(0deg) scale(1)"
    }

    return (
        <div
            ref={cardRef}
            onMouseMove={handleMouseMove}
            onMouseLeave={resetTilt}
            onClick={() => navigate(`/slots/${lot._id}`)}
            className="
                relative
                group
                cursor-pointer
                overflow-hidden
                rounded-2xl
                p-6
                backdrop-blur-2xl
                bg-white/[0.04]
                border border-white/10
                transition-all duration-500 ease-out
                hover:border-white/20
                hover:shadow-[0_25px_60px_rgba(0,0,0,0.6)]
            "
        >

            {/* Hover Gradient Glow */}
            <div className="
                pointer-events-none
                absolute inset-0
                opacity-0 group-hover:opacity-100
                transition duration-500
                bg-linear-to-br from-indigo-600/10 via-transparent to-cyan-500/10
            " />

            <div className="relative z-10">

                {/* TITLE */}
                <div className="flex justify-between items-start mb-5">
                    <div>
                        <h3 className="text-lg font-semibold tracking-tight">
                            {lot.name}
                        </h3>

                        <div className="flex items-center gap-2 text-sm text-neutral-400 mt-2">
                            <MapPin size={14} className="opacity-70" />
                            {lot.location?.address || "No address provided"}
                        </div>
                    </div>

                    <MoreVertical
                        size={18}
                        className="text-neutral-500 group-hover:text-white transition"
                    />
                </div>

                {/* STATS */}
                <div className="text-sm text-neutral-300 mb-5">
                    <span className="font-medium">
                        {lot.totalSlots}
                    </span>{" "}
                    total slots •{" "}
                    <span className="font-medium text-white">
                        {lot.occupiedCount || 0}
                    </span>{" "}
                    occupied
                </div>

                {/* OCCUPANCY */}
                <div className="mb-5">
                    <div className="flex justify-between text-xs text-neutral-400 mb-2">
                        <span>OCCUPANCY</span>
                        <span
                            className={
                                occupancy > 80
                                    ? "text-rose-400"
                                    : occupancy > 60
                                        ? "text-amber-400"
                                        : "text-blue-400"
                            }
                        >
                            {occupancy}%
                        </span>
                    </div>

                    <ProgressBar value={occupancy} />
                </div>

                {/* FOOTER */}
                <div className="flex justify-between items-center mt-6">

                    <span
                        className={`
                            text-xs px-3 py-1 rounded-full
                            backdrop-blur-md
                            border border-white/10
                            transition
                            ${lot.active
                                ? "bg-emerald-500/15 text-emerald-400"
                                : "bg-rose-500/15 text-rose-400"}
                        `}
                    >
                        {lot.active ? "Active" : "Disabled"}
                    </span>

                    <span
                        className="
                            text-sm text-neutral-400
                            transition-colors duration-300
                            group-hover:text-white
                        "
                    >
                        Manage →
                    </span>

                </div>
            </div>
        </div>
    )
}
