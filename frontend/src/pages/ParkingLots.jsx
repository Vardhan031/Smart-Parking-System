import { useEffect, useState } from "react"
import api from "../services/api"

import StatsRow from "../components/parkinglots/StatsRow"
import SearchBar from "../components/parkinglots/SearchBar"
import ParkingLotCard from "../components/parkinglots/ParkingLotCard"

export default function ParkingLots() {
    const [lots, setLots] = useState([])
    const [search, setSearch] = useState("")
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState("")
    const [visible, setVisible] = useState(false)

    useEffect(() => {
        fetchLots()
        setTimeout(() => setVisible(true), 100)
    }, [])

    const fetchLots = async () => {
        try {
            const res = await api.get("/admin/lots")
            setLots(res.data.data)
        } catch (err) {
            setError("Failed to fetch parking lots")
        } finally {
            setLoading(false)
        }
    }

    const filteredLots = lots.filter((lot) =>
        lot.name.toLowerCase().includes(search.toLowerCase())
    )

    const totalLots = lots.length
    const activeLots = lots.filter((l) => l.active).length
    const totalSlots = lots.reduce((a, b) => a + b.totalSlots, 0)

    return (
        <div className="min-h-screen bg-[#0B1220] text-white px-10 py-8 relative overflow-hidden">

            {/* Background Glows */}
            <div className="absolute top-0 left-1/3 w-[700px] h-[700px] bg-indigo-600/10 blur-[120px] rounded-full"></div>
            <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-cyan-500/10 blur-[120px] rounded-full"></div>

            <div
                className={`relative z-10 transition-all duration-700 ${visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
                    }`}
            >

                {/* HEADER */}
                <div className="flex justify-between items-start mb-12">
                    <div>
                        <h1 className="text-3xl font-semibold tracking-tight">
                            Parking Lots
                        </h1>
                        <p className="text-neutral-400 mt-2">
                            Manage and monitor all parking facilities
                        </p>
                    </div>
                </div>

                {/* LOADING STATE */}
                {loading && (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                        {[...Array(6)].map((_, i) => (
                            <div
                                key={i}
                                className="
                                    h-40
                                    rounded-2xl
                                    bg-white/[0.04]
                                    border border-white/10
                                    animate-pulse
                                "
                            />
                        ))}
                    </div>
                )}

                {/* ERROR STATE */}
                {error && (
                    <div className="
                        backdrop-blur-xl
                        bg-rose-500/10
                        border border-rose-500/30
                        rounded-2xl
                        p-6
                        text-rose-400
                    ">
                        {error}
                    </div>
                )}

                {/* CONTENT */}
                {!loading && !error && (
                    <>
                        {/* Stats */}
                        <div className="mb-10">
                            <StatsRow
                                totalLots={totalLots}
                                activeLots={activeLots}
                                totalSlots={totalSlots}
                                occupiedSlots={0}
                            />
                        </div>

                        {/* Search */}
                        <div className="mb-10">
                            <SearchBar search={search} setSearch={setSearch} />
                        </div>

                        {/* Empty State */}
                        {filteredLots.length === 0 ? (
                            <div className="
                                backdrop-blur-xl
                                bg-white/[0.04]
                                border border-white/10
                                rounded-2xl
                                p-10
                                text-center
                                text-neutral-400
                            ">
                                No parking lots found.
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                                {filteredLots.map((lot, index) => (
                                    <div
                                        key={lot._id}
                                        className="transition-all duration-500"
                                        style={{
                                            transitionDelay: `${index * 80}ms`
                                        }}
                                    >
                                        <ParkingLotCard lot={lot} />
                                    </div>
                                ))}
                            </div>
                        )}
                    </>
                )}

            </div>
        </div>
    )
}
