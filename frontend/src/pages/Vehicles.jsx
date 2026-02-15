import { useState, useEffect } from "react"
import { Car, Search } from "lucide-react"
import api from "../services/api"

const PAGE_SIZE = 15

export default function Vehicles() {
    const [vehicles, setVehicles] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState("")
    const [search, setSearch] = useState("")
    const [totalCount, setTotalCount] = useState(0)
    const [page, setPage] = useState(0)
    const [visible, setVisible] = useState(false)

    const fetchVehicles = async () => {
        try {
            setLoading(true)
            setError("")

            const offset = page * PAGE_SIZE
            const params = new URLSearchParams({ limit: PAGE_SIZE, offset })
            if (search) params.set("search", search)

            const res = await api.get(`/admin/vehicles?${params}`)
            setVehicles(res.data.data || [])
            setTotalCount(res.data.totalCount || 0)
        } catch (err) {
            console.error("Fetch Vehicles Error:", err)
            setError("Failed to fetch vehicles")
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        setTimeout(() => setVisible(true), 100)
    }, [])

    useEffect(() => {
        setPage(0)
    }, [search])

    useEffect(() => {
        fetchVehicles()
    }, [page, search])

    const totalPages = Math.ceil(totalCount / PAGE_SIZE)

    return (
        <div className="min-h-screen bg-[#0B1220] text-white px-10 py-8 relative overflow-hidden">

            {/* Background Glows */}
            <div className="absolute top-0 left-1/3 w-[700px] h-[700px] bg-indigo-600/10 blur-[120px] rounded-full"></div>
            <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-cyan-500/10 blur-[120px] rounded-full"></div>

            <div
                className={`relative z-10 transition-all duration-700 ${visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}`}
            >

                {/* Header */}
                <div className="flex justify-between items-start mb-10">
                    <div>
                        <h1 className="text-3xl font-semibold tracking-tight">Vehicles</h1>
                        <p className="text-neutral-400 mt-2">
                            {totalCount} registered vehicle{totalCount !== 1 ? "s" : ""}
                        </p>
                    </div>

                    <div className="flex items-center gap-3 px-4 py-3 bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl">
                        <Car size={16} className="text-indigo-400" />
                        <span className="text-sm text-neutral-300">{totalCount} total</span>
                    </div>
                </div>

                {/* Search */}
                <div className="mb-8 max-w-md">
                    <div className="flex items-center gap-3 px-4 py-3 bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl">
                        <Search size={16} className="text-neutral-400" />
                        <input
                            type="text"
                            placeholder="Search by plate or owner email..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="bg-transparent outline-none text-sm text-white placeholder-neutral-500 w-full"
                        />
                    </div>
                </div>

                {/* Table */}
                <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl shadow-2xl p-8 overflow-x-auto">

                    {loading && (
                        <div className="text-center py-8 text-gray-400 animate-pulse">
                            Loading vehicles...
                        </div>
                    )}

                    {error && (
                        <div className="text-center py-8 text-red-400">{error}</div>
                    )}

                    {!loading && vehicles.length === 0 && !error && (
                        <div className="text-center py-8 text-gray-500">
                            No vehicles found.
                        </div>
                    )}

                    {!loading && vehicles.length > 0 && (
                        <>
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="border-b border-white/10 text-gray-400 text-sm">
                                        <th className="py-4">Plate Number</th>
                                        <th>Owner</th>
                                        <th>Email</th>
                                        <th>Registered</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {vehicles.map((v, i) => (
                                        <tr
                                            key={`${v.ownerId}-${v.plate}-${i}`}
                                            className="border-b border-white/5 hover:bg-white/5 transition-all duration-200"
                                        >
                                            <td className="py-4">
                                                <span className="font-semibold tracking-wider bg-white/5 px-3 py-1 rounded-lg">
                                                    {v.plate}
                                                </span>
                                            </td>
                                            <td className="text-neutral-300">{v.ownerName}</td>
                                            <td className="text-neutral-400">{v.ownerEmail}</td>
                                            <td className="text-neutral-400">
                                                {v.createdAt
                                                    ? new Date(v.createdAt).toLocaleDateString()
                                                    : "-"}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>

                            {/* Pagination */}
                            {totalPages > 1 && (
                                <div className="flex items-center justify-between mt-6 pt-4 border-t border-white/10">
                                    <p className="text-sm text-neutral-400">
                                        Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, totalCount)} of {totalCount}
                                    </p>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => setPage((p) => Math.max(0, p - 1))}
                                            disabled={page === 0}
                                            className="px-4 py-2 text-sm rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition cursor-pointer"
                                        >
                                            Previous
                                        </button>
                                        <button
                                            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                                            disabled={page >= totalPages - 1}
                                            className="px-4 py-2 text-sm rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition cursor-pointer"
                                        >
                                            Next
                                        </button>
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>
    )
}
