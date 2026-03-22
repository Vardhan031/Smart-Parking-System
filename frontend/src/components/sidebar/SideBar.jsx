import {
    LayoutDashboard,
    ParkingSquare,
    Clock,
    ScanLine,
    Car,
    BarChart3,
    Settings,
    LogOut
} from "lucide-react"
import SidebarItem from "./SideBarItem"
import { useNavigate } from "react-router-dom"

export default function Sidebar() {
    const navigate = useNavigate()

    const handleLogout = () => {
        localStorage.removeItem("token")
        navigate("/login")
    }

    return (
        <div className="flex flex-col h-full px-4 py-5">

            {/* Logo */}
            <div className="flex items-center gap-2.5 px-2 mb-7">
                <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center shrink-0 shadow-lg shadow-indigo-500/30">
                    <ParkingSquare size={15} className="text-white" />
                </div>
                <div>
                    <h1 className="text-sm font-semibold leading-none tracking-tight">SmartPark</h1>
                    <p className="text-[10px] text-neutral-500 mt-0.5">Admin Portal</p>
                </div>
            </div>

            {/* Navigation */}
            <nav className="flex-1 space-y-5">

                <div className="space-y-0.5">
                    <SidebarItem icon={LayoutDashboard} label="Dashboard" to="/" />
                </div>

                <div>
                    <p className="text-[10px] uppercase tracking-widest text-neutral-600 mb-2 px-2">
                        Parking
                    </p>
                    <div className="space-y-0.5">
                        <SidebarItem icon={ParkingSquare} label="Parking Lots" to="/lots" />
                        <SidebarItem icon={Clock} label="Sessions" to="/sessions" />
                        <SidebarItem icon={ScanLine} label="Gate Control" to="/gate" />
                    </div>
                </div>

                <div>
                    <p className="text-[10px] uppercase tracking-widest text-neutral-600 mb-2 px-2">
                        Insights
                    </p>
                    <div className="space-y-0.5">
                        <SidebarItem icon={Car} label="Vehicles" to="/vehicles" />
                        <SidebarItem icon={BarChart3} label="Analytics" to="/analytics" />
                    </div>
                </div>

            </nav>

            {/* Bottom */}
            <div className="pt-4 border-t border-white/[0.06] space-y-0.5">
                <SidebarItem icon={Settings} label="Settings" to="/settings" />
                <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-neutral-500 hover:bg-white/[0.04] hover:text-rose-400 transition-all duration-200 cursor-pointer"
                >
                    <LogOut size={16} className="shrink-0" />
                    <span>Log out</span>
                </button>
            </div>

        </div>
    )
}
