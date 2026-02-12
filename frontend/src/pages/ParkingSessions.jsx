import React, { useState, useEffect } from "react";
import api from "../services/api";

const ParkingSessions = () => {
    const [activeTab, setActiveTab] = useState("IN");
    const [sessions, setSessions] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    const fetchSessions = async (status) => {
        try {
            setLoading(true);
            setError("");

            const res = await api.get(`/sessions?status=${status}`);
            setSessions(res.data.data || []);
        } catch (err) {
            console.error("Fetch Sessions Error:", err);
            setError("Failed to fetch sessions");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchSessions(activeTab);
    }, [activeTab]);

    const formatDate = (date) => {
        if (!date) return "-";
        return new Date(date).toLocaleString();
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-[#0f172a] via-[#111827] to-black text-white p-10">

            {/* Title */}
            <h1 className="text-3xl font-bold mb-10 tracking-wide">
                Parking Sessions
            </h1>

            {/* Premium Glass Tabs */}
            <div className="flex justify-center mb-10">
                <div className="relative flex bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-1 shadow-2xl">

                    {/* Active Glow */}
                    <div
                        className={`absolute top-1 bottom-1 w-1/2 rounded-xl transition-all duration-300 ${activeTab === "IN"
                            ? "left-1 bg-blue-600/20"
                            : "left-1/2 bg-green-600/20"
                            }`}
                    />

                    <button
                        onClick={() => setActiveTab("IN")}
                        className={`relative z-10 px-8 py-3 rounded-xl text-sm font-medium transition-all duration-300 cursor-pointer ${activeTab === "IN"
                            ? "text-blue-400"
                            : "text-gray-400 hover:text-white"
                            }`}
                    >
                        Active Sessions
                    </button>

                    <button
                        onClick={() => setActiveTab("OUT")}
                        className={`relative z-10 px-8 py-3 rounded-xl text-sm font-medium transition-all duration-300 cursor-pointer ${activeTab === "OUT"
                            ? "text-green-400"
                            : "text-gray-400 hover:text-white"
                            }`}
                    >
                        Completed Sessions
                    </button>
                </div>
            </div>

            {/* Glass Table Container */}
            <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl shadow-2xl p-8 overflow-x-auto">

                {loading && (
                    <div className="text-center py-8 text-gray-400 animate-pulse">
                        Loading sessions...
                    </div>
                )}

                {error && (
                    <div className="text-center py-8 text-red-400">
                        {error}
                    </div>
                )}

                {!loading && sessions.length === 0 && !error && (
                    <div className="text-center py-8 text-gray-500">
                        No sessions found.
                    </div>
                )}

                {!loading && sessions.length > 0 && (
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="border-b border-white/10 text-gray-400 text-sm">
                                <th className="py-4">Plate</th>
                                <th>Lot</th>
                                <th>Slot</th>
                                <th>Entry Time</th>
                                <th>Exit Time</th>
                                <th>Duration (min)</th>
                                <th>Status</th>
                            </tr>
                        </thead>

                        <tbody>
                            {sessions.map((session) => (
                                <tr
                                    key={session._id}
                                    className="border-b border-white/5 hover:bg-white/5 transition-all duration-200"
                                >
                                    <td className="py-4 font-semibold tracking-wide">
                                        {session.plateNumber}
                                    </td>

                                    <td>{session.lotId?.name || "N/A"}</td>

                                    <td>{session.slotNumber}</td>

                                    <td>{formatDate(session.entryTime)}</td>

                                    <td>{formatDate(session.exitTime)}</td>

                                    <td>{session.durationMinutes ?? "-"}</td>

                                    <td>
                                        <span
                                            className={`px-3 py-1 text-xs rounded-full font-medium ${session.status === "IN"
                                                ? "bg-blue-500/20 text-blue-400"
                                                : "bg-green-500/20 text-green-400"
                                                }`}
                                        >
                                            {session.status}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
};

export default ParkingSessions;
