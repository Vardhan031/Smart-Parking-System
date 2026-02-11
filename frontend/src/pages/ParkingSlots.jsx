import { useParams } from "react-router-dom"
import { useEffect, useState, useRef } from "react"
import { Car } from "lucide-react"
import api from "../services/api"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "../components/ui/dialog"

export default function ParkingSlots() {
    const { lotId } = useParams()

    const [slots, setSlots] = useState([])
    const [loading, setLoading] = useState(true)
    const [visible, setVisible] = useState(false)

    const [selectedSession, setSelectedSession] = useState(null)
    const [modalOpen, setModalOpen] = useState(false)

    useEffect(() => {
        fetchSlots()
        setTimeout(() => setVisible(true), 100)
    }, [lotId])

    const fetchSlots = async () => {
        try {
            const res = await api.get(`/admin/slots/${lotId}`)
            setSlots(res.data.data)
        } catch (err) {
            console.error("Failed to fetch slots")
        } finally {
            setLoading(false)
        }
    }

    const handleSlotClick = async (slot) => {
        if (slot.status !== "OCCUPIED") return

        try {
            const res = await api.get(
                `/admin/session/active/${lotId}/${slot.slotNumber}`
            )

            setSelectedSession(res.data.data)
            setModalOpen(true)
        } catch (err) {
            console.error("No active session found")
        }
    }

    if (loading) {
        return (
            <div className="min-h-screen bg-[#0B1220] flex items-center justify-center text-neutral-400">
                Loading layout...
            </div>
        )
    }

    const sortedSlots = [...slots].sort(
        (a, b) => a.slotNumber - b.slotNumber
    )

    const rows = []
    const slotsPerRow = 10

    for (let i = 0; i < sortedSlots.length; i += slotsPerRow) {
        rows.push(sortedSlots.slice(i, i + slotsPerRow))
    }

    return (
        <div className="min-h-screen bg-[#0B1220] text-white px-10 py-8 relative overflow-hidden">

            {/* Background Glow */}
            <div className="absolute top-0 left-1/3 w-[800px] h-[800px] bg-indigo-600/10 blur-[120px] rounded-full"></div>
            <div className="absolute bottom-0 right-1/4 w-[600px] h-[600px] bg-cyan-500/10 blur-[120px] rounded-full"></div>

            <div
                className={`relative z-10 transition-all duration-700 ${visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
                    }`}
            >

                {/* Header */}
                <div className="mb-10">
                    <h1 className="text-3xl font-semibold tracking-tight">
                        Parking Layout
                    </h1>
                    <p className="text-neutral-400 mt-2">
                        {slots.filter(s => s.status === "AVAILABLE").length} slots available
                    </p>
                </div>

                {/* Layout Container */}
                <div className="
                    backdrop-blur-2xl
                    bg-white/[0.04]
                    border border-white/10
                    rounded-2xl
                    p-8"
                >

                    <div className="space-y-8">

                        {rows.map((rowSlots, rowIndex) => (
                            <div key={rowIndex} className="mb-12">

                                {/* Row Label */}
                                <div className="text-neutral-400 font-medium mb-4">
                                    Row {String.fromCharCode(65 + rowIndex)}
                                </div>

                                {/* LANE GRID */}
                                <div className="
                                grid
                                grid-cols-1
                                sm:grid-cols-2
                                md:grid-cols-5
                                gap-8"
                                >

                                    {Array.from({ length: 5 }).map((_, laneIndex) => {
                                        const baseIndex = laneIndex * 2
                                        const slot1 = rowSlots[baseIndex]
                                        const slot2 = rowSlots[baseIndex + 1]

                                        if (!slot1) return null

                                        return (
                                            <div key={laneIndex} className="flex items-center gap-4">

                                                <Slot
                                                    number={slot1.slotNumber}
                                                    status={slot1.status}
                                                    onClick={() => handleSlotClick(slot1)}
                                                />

                                                {slot2 && (
                                                    <>
                                                        {/* Divider */}
                                                        <div className="w-[6px] h-16 lg:h-20 bg-white/10 rounded-sm" />

                                                        <Slot
                                                            number={slot2.slotNumber}
                                                            status={slot2.status}
                                                            onClick={() => handleSlotClick(slot2)}
                                                        />
                                                    </>
                                                )}

                                            </div>
                                        )
                                    })}

                                </div>

                            </div>
                        ))}


                    </div>
                </div>
            </div>

            {/* Modal */}
            <Dialog open={modalOpen} onOpenChange={setModalOpen}>
                <DialogContent className="backdrop-blur-xl bg-[#111C2D] border border-white/10 text-white">
                    <DialogHeader>
                        <DialogTitle>Active Parking Session</DialogTitle>
                    </DialogHeader>

                    {selectedSession && (
                        <div className="space-y-3 text-sm text-neutral-300">
                            <p><strong>Plate:</strong> {selectedSession.plateNumber}</p>
                            <p><strong>Entry:</strong> {new Date(selectedSession.entryTime).toLocaleString()}</p>
                            <p><strong>Status:</strong> {selectedSession.status}</p>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    )
}

/* ---------------- SLOT COMPONENT ---------------- */

function Slot({ number, status, onClick }) {
    const cardRef = useRef(null)

    const isOccupied = status === "OCCUPIED"

    const handleMouseMove = (e) => {
        const card = cardRef.current
        const rect = card.getBoundingClientRect()

        const x = e.clientX - rect.left
        const y = e.clientY - rect.top

        const centerX = rect.width / 2
        const centerY = rect.height / 2

        const rotateX = ((y - centerY) / centerY) * 4
        const rotateY = ((x - centerX) / centerX) * -4

        card.style.transform =
            `perspective(600px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale(1.05)`
    }

    const resetTilt = () => {
        cardRef.current.style.transform =
            "perspective(600px) rotateX(0deg) rotateY(0deg) scale(1)"
    }

    return (
        <div
            ref={cardRef}
            onMouseMove={handleMouseMove}
            onMouseLeave={resetTilt}
            onClick={onClick}
            className={`
                relative
                cursor-pointer
                w-16 h-16 lg:w-20 lg:h-20
                rounded-xl
                backdrop-blur-md
                border
                transition-all duration-300
                flex items-center justify-center
                ${isOccupied
                    ? "bg-rose-500/10 border-rose-500/30 hover:bg-rose-500/20"
                    : "bg-green-500/10 border-white/10 hover:border-emerald-400/40"
                }
            `}
        >

            <span className="absolute bottom-2 right-2 text-[10px] text-neutral-400">
                {number}
            </span>

            {isOccupied && (
                <Car
                    size={24}
                    className="text-rose-400"
                />
            )}
        </div>
    )
}
