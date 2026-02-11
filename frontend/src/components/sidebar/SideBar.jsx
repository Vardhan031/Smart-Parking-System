import {
    LayoutDashboard,
    ParkingSquare,
    Clock,
    Car,
    BarChart3,
    Settings
} from "lucide-react"
import SidebarItem from "./SideBarItem"

export default function Sidebar() {
    return (
        <div className="flex flex-col h-full px-6 py-8">

            {/* Logo Section */}
            <div className="mb-10">
                <h1 className="text-2xl font-semibold tracking-tight">
                    SmartPark
                </h1>
                <p className="text-xs text-neutral-400 mt-1">
                    Parking Admin
                </p>
            </div>

            {/* Navigation */}
            <nav className="flex-1 space-y-8">

                <div className="space-y-2">
                    <SidebarItem icon={LayoutDashboard} label="Dashboard" to="/" />
                </div>

                <div>
                    <p className="text-xs uppercase tracking-widest text-neutral-500 mb-3">
                        Parking Management
                    </p>

                    <div className="space-y-2">
                        <SidebarItem icon={ParkingSquare} label="Parking Lots" to="/lots" />
                        <SidebarItem icon={Clock} label="Sessions" to="/sessions" />
                    </div>
                </div>

                <div>
                    <p className="text-xs uppercase tracking-widest text-neutral-500 mb-3">
                        Insights
                    </p>

                    <div className="space-y-2">
                        <SidebarItem icon={Car} label="Vehicles" to="/vehicles" />
                        <SidebarItem icon={BarChart3} label="Analytics" to="/analytics" />
                    </div>
                </div>

            </nav>

            {/* Bottom Section */}
            <div className="pt-6 border-t border-white/10">
                <SidebarItem icon={Settings} label="Settings" to="/settings" />
            </div>

        </div>
    )
}
