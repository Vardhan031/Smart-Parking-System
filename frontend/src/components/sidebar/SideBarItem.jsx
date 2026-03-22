import { NavLink } from "react-router-dom"

export default function SidebarItem({ icon: Icon, label, to }) {
    return (
        <NavLink
            to={to}
            end={to === "/"}
            className={({ isActive }) => `
                flex items-center gap-3
                px-3 py-2.5
                rounded-lg
                text-sm font-medium
                transition-all duration-200
                cursor-pointer
                ${isActive
                    ? "bg-indigo-500/10 text-white [&>svg]:text-indigo-400"
                    : "text-neutral-400 hover:bg-white/[0.04] hover:text-neutral-200 [&>svg]:text-neutral-500"
                }
            `}
        >
            <Icon size={16} className="shrink-0 transition-colors" />
            <span>{label}</span>
        </NavLink>
    )
}
