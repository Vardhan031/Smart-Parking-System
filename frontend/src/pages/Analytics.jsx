import { useState, useEffect } from "react"
import {
    DollarSign,
    TrendingUp,
    ArrowUpRight,
    ArrowDownRight,
    Clock,
    CreditCard
} from "lucide-react"
import api from "../services/api"

const PAGE_SIZE = 15

export default function Analytics() {
    const [overview, setOverview] = useState(null)
    const [transactions, setTransactions] = useState([])
    const [txTotalCount, setTxTotalCount] = useState(0)
    const [txPage, setTxPage] = useState(0)
    const [txFilter, setTxFilter] = useState("")
    const [txLoading, setTxLoading] = useState(false)
    const [visible, setVisible] = useState(false)

    useEffect(() => {
        fetchOverview()
        setTimeout(() => setVisible(true), 100)
    }, [])

    useEffect(() => {
        fetchTransactions()
    }, [txPage, txFilter])

    useEffect(() => {
        setTxPage(0)
    }, [txFilter])

    const fetchOverview = async () => {
        try {
            const res = await api.get("/dashboard/overview")
            setOverview(res.data.data)
        } catch (err) {
            console.error("Fetch Overview Error:", err)
        }
    }

    const fetchTransactions = async () => {
        try {
            setTxLoading(true)
            const offset = txPage * PAGE_SIZE
            const params = new URLSearchParams({ limit: PAGE_SIZE, offset })
            if (txFilter) params.set("type", txFilter)

            const res = await api.get(`/admin/transactions?${params}`)
            setTransactions(res.data.data || [])
            setTxTotalCount(res.data.totalCount || 0)
        } catch (err) {
            console.error("Fetch Transactions Error:", err)
        } finally {
            setTxLoading(false)
        }
    }

    const txTotalPages = Math.ceil(txTotalCount / PAGE_SIZE)

    return (
        <div className="min-h-screen bg-[#0B1220] text-white px-10 py-8 relative overflow-hidden">

            {/* Background Glows */}
            <div className="absolute top-0 left-1/3 w-[800px] h-[800px] bg-indigo-600/10 blur-[120px] rounded-full"></div>
            <div className="absolute bottom-0 right-1/4 w-[600px] h-[600px] bg-cyan-500/10 blur-[120px] rounded-full"></div>

            <div
                className={`relative z-10 transition-all duration-700 ${visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}`}
            >

                {/* Header */}
                <div className="mb-10">
                    <h1 className="text-3xl font-semibold tracking-tight">Analytics</h1>
                    <p className="text-neutral-400 mt-2">
                        Revenue, transactions, and session insights
                    </p>
                </div>

                {/* Revenue Metrics */}
                {overview && (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-12">
                        <MetricCard
                            icon={DollarSign}
                            title="Today's Revenue"
                            value={`$${(overview.todayRevenue ?? 0).toLocaleString()}`}
                            color="text-emerald-400"
                            bg="from-emerald-500/30 to-emerald-500/5"
                        />
                        <MetricCard
                            icon={ArrowUpRight}
                            title="Today's Entries"
                            value={overview.todayEntries}
                            color="text-blue-400"
                            bg="from-blue-500/30 to-blue-500/5"
                        />
                        <MetricCard
                            icon={ArrowDownRight}
                            title="Today's Exits"
                            value={overview.todayExits}
                            color="text-rose-400"
                            bg="from-rose-500/30 to-rose-500/5"
                        />
                        <MetricCard
                            icon={Clock}
                            title="Avg Park Time"
                            value={`${overview.avgParkTime} min`}
                            color="text-indigo-400"
                            bg="from-indigo-500/30 to-indigo-500/5"
                        />
                    </div>
                )}

                {/* Vs Yesterday + Utilization */}
                {overview && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
                        <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl p-6 flex items-center gap-4">
                            <div className={`p-3 rounded-xl bg-white/5 ${
                                overview.vsYesterday >= 0 ? "text-emerald-400" : "text-rose-400"
                            }`}>
                                <TrendingUp size={18} />
                            </div>
                            <div>
                                <p className={`text-lg font-semibold ${
                                    overview.vsYesterday >= 0 ? "text-emerald-400" : "text-rose-400"
                                }`}>
                                    {overview.vsYesterday >= 0 ? "+" : ""}{overview.vsYesterday}%
                                </p>
                                <p className="text-sm text-neutral-400">vs yesterday entries</p>
                            </div>
                        </div>

                        <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl p-6 flex items-center gap-4">
                            <div className="p-3 rounded-xl bg-white/5 text-cyan-400">
                                <CreditCard size={18} />
                            </div>
                            <div>
                                <p className="text-lg font-semibold text-cyan-400">
                                    {overview.utilizationPercentage}%
                                </p>
                                <p className="text-sm text-neutral-400">
                                    System utilization • {overview.totalOccupied}/{overview.totalSlots} slots
                                </p>
                            </div>
                        </div>
                    </div>
                )}

                {/* Transactions Section */}
                <div className="mb-6 flex justify-between items-center">
                    <h2 className="text-xl font-semibold">Wallet Transactions</h2>

                    <div className="flex gap-2">
                        {["", "CREDIT", "DEBIT"].map((f) => (
                            <button
                                key={f}
                                onClick={() => setTxFilter(f)}
                                className={`px-4 py-2 text-xs rounded-xl border transition cursor-pointer ${
                                    txFilter === f
                                        ? "bg-indigo-500/20 border-indigo-400/40 text-indigo-400"
                                        : "bg-white/5 border-white/10 text-neutral-400 hover:text-white"
                                }`}
                            >
                                {f || "All"}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl shadow-2xl p-8 overflow-x-auto">

                    {txLoading && (
                        <div className="text-center py-8 text-gray-400 animate-pulse">
                            Loading transactions...
                        </div>
                    )}

                    {!txLoading && transactions.length === 0 && (
                        <div className="text-center py-8 text-gray-500">
                            No transactions found.
                        </div>
                    )}

                    {!txLoading && transactions.length > 0 && (
                        <>
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="border-b border-white/10 text-gray-400 text-sm">
                                        <th className="py-4">User</th>
                                        <th>Type</th>
                                        <th>Amount</th>
                                        <th>Description</th>
                                        <th>Date</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {transactions.map((tx) => (
                                        <tr
                                            key={tx._id}
                                            className="border-b border-white/5 hover:bg-white/5 transition-all duration-200"
                                        >
                                            <td className="py-4">
                                                <div>
                                                    <p className="text-sm font-medium">{tx.userName}</p>
                                                    <p className="text-xs text-neutral-400">{tx.userEmail}</p>
                                                </div>
                                            </td>
                                            <td>
                                                <span className={`px-3 py-1 text-xs rounded-full font-medium ${
                                                    tx.type === "CREDIT"
                                                        ? "bg-emerald-500/20 text-emerald-400"
                                                        : "bg-rose-500/20 text-rose-400"
                                                }`}>
                                                    {tx.type}
                                                </span>
                                            </td>
                                            <td className={`font-semibold ${
                                                tx.type === "CREDIT" ? "text-emerald-400" : "text-rose-400"
                                            }`}>
                                                {tx.type === "CREDIT" ? "+" : "-"}${tx.amount}
                                            </td>
                                            <td className="text-neutral-400 text-sm">
                                                {tx.description || "-"}
                                            </td>
                                            <td className="text-neutral-400 text-sm">
                                                {new Date(tx.createdAt).toLocaleString()}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>

                            {/* Pagination */}
                            {txTotalPages > 1 && (
                                <div className="flex items-center justify-between mt-6 pt-4 border-t border-white/10">
                                    <p className="text-sm text-neutral-400">
                                        Showing {txPage * PAGE_SIZE + 1}–{Math.min((txPage + 1) * PAGE_SIZE, txTotalCount)} of {txTotalCount}
                                    </p>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => setTxPage((p) => Math.max(0, p - 1))}
                                            disabled={txPage === 0}
                                            className="px-4 py-2 text-sm rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition cursor-pointer"
                                        >
                                            Previous
                                        </button>
                                        <button
                                            onClick={() => setTxPage((p) => Math.min(txTotalPages - 1, p + 1))}
                                            disabled={txPage >= txTotalPages - 1}
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

/* ---------- METRIC CARD ---------- */

function MetricCard({ icon: Icon, title, value, color, bg }) {
    return (
        <div className="backdrop-blur-2xl bg-white/[0.04] border border-white/10 rounded-2xl p-6 transition-all duration-300 hover:bg-white/[0.06]">
            <div className={`p-3 rounded-xl bg-gradient-to-br ${bg} ${color} w-fit mb-4`}>
                <Icon size={18} />
            </div>
            <h3 className="text-2xl font-semibold">{value}</h3>
            <p className="text-sm text-neutral-400 mt-1">{title}</p>
        </div>
    )
}
