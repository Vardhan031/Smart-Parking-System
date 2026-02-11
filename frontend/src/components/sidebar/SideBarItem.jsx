import { NavLink } from "react-router-dom"

export default function SidebarItem({ icon: Icon, label, to }) {
    return (
        <NavLink
            to={to}
            className={({ isActive }) => `
                group
                flex items-center gap-3
                px-4 py-3
                rounded-xl
                text-sm font-medium
                transition-all duration-300
                ${isActive
                    ? "bg-white/10 border border-white/10 text-white shadow-lg"
                    : "text-neutral-400 hover:bg-white/5 hover:text-white"
                }
            `}
        >
            <Icon size={18} className="opacity-80 group-hover:opacity-100" />
            <span>{label}</span>
        </NavLink>
    )
}
