import { Outlet } from "react-router-dom"
import SideBar from "../components/sidebar/SideBar.jsx"

export default function AppLayout() {
    return (
        <div className="h-screen bg-[#0B1220] text-white overflow-hidden relative">

            {/* Background Glow */}
            <div className="absolute top-0 left-1/4 w-[900px] h-[900px] bg-indigo-600/10 blur-[140px] rounded-full pointer-events-none"></div>
            <div className="absolute bottom-0 right-1/4 w-[700px] h-[700px] bg-cyan-500/10 blur-[140px] rounded-full pointer-events-none"></div>

            <div className="flex h-full relative z-10">

                {/* Sidebar (Fixed Height, No Scroll) */}
                <aside className="
                    w-72
                    h-full
                    backdrop-blur-2xl
                    bg-white/[0.03]
                    border-r border-white/10
                ">
                    <SideBar />
                </aside>

                {/* Scrollable Main Content */}
                <main className="
                    flex-1
                    h-full
                    overflow-y-auto
                    px-12 py-10
                ">
                    <Outlet />
                </main>

            </div>
        </div>
    )
}
