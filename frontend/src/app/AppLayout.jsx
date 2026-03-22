import { Outlet, useLocation } from "react-router-dom"
import { Bell, ChevronRight } from "lucide-react"
import SideBar from "../components/sidebar/SideBar.jsx"

const PAGE_TITLES = {
    "/": "Dashboard",
    "/lots": "Parking Lots",
    "/sessions": "Sessions",
    "/gate": "Gate Control",
    "/vehicles": "Vehicles",
    "/analytics": "Analytics",
    "/settings": "Settings",
}

export default function AppLayout() {
    const { pathname } = useLocation()
    const pageTitle = pathname.startsWith("/slots/")
        ? "Parking Layout"
        : (PAGE_TITLES[pathname] || "Dashboard")

    return (
        <div className="h-screen bg-[#0B1220] text-white overflow-hidden relative">

            {/* Background Glow */}
            <div className="absolute top-0 left-1/4 w-[900px] h-[900px] bg-indigo-600/10 blur-[140px] rounded-full pointer-events-none" />
            <div className="absolute bottom-0 right-1/4 w-[700px] h-[700px] bg-cyan-500/10 blur-[140px] rounded-full pointer-events-none" />

            <div className="flex h-full relative z-10">

                {/* Sidebar */}
                <aside className="w-64 h-full shrink-0 backdrop-blur-2xl bg-white/[0.02] border-r border-white/[0.06]">
                    <SideBar />
                </aside>

                {/* Main area */}
                <main className="flex-1 h-full overflow-hidden flex flex-col">

                    {/* Top Header */}
                    <header className="h-14 shrink-0 border-b border-white/[0.06] flex items-center justify-between px-8 backdrop-blur-xl bg-white/[0.01]">
                        <div className="flex items-center gap-2">
                            <span className="text-neutral-500 text-xs">SmartPark</span>
                            <ChevronRight size={13} className="text-neutral-600" />
                            <span className="text-neutral-200 font-medium text-sm">{pageTitle}</span>
                        </div>

                        <div className="flex items-center gap-1">
                            <button className="relative p-2 rounded-xl hover:bg-white/[0.06] transition text-neutral-400 hover:text-white">
                                <Bell size={15} />
                                <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-indigo-500 rounded-full" />
                            </button>

                            <div className="w-px h-4 bg-white/10 mx-1" />

                            <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl hover:bg-white/[0.06] transition cursor-pointer">
                                <div className="w-6 h-6 rounded-full bg-indigo-600/40 border border-indigo-500/40 flex items-center justify-center text-[10px] font-semibold text-indigo-300">
                                    A
                                </div>
                                <div>
                                    <p className="text-xs font-medium text-neutral-200 leading-none">Admin</p>
                                    <p className="text-[10px] text-neutral-500 mt-0.5">Administrator</p>
                                </div>
                            </div>
                        </div>
                    </header>

                    {/* Scrollable Content */}
                    <div className="flex-1 overflow-y-auto">
                        <Outlet />
                    </div>

                </main>
            </div>
        </div>
    )
}
