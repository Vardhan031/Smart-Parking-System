import { Search, SlidersHorizontal } from "lucide-react"

export default function SearchBar({ search, setSearch }) {
    return (
        <div className="flex items-center gap-4 mb-8">

            {/* Search Input */}
            <div className="
                relative
                backdrop-blur-xl
                bg-white/[0.04]
                border border-white/10
                rounded-xl
                transition-all duration-300
                focus-within:border-indigo-400/50
                focus-within:shadow-[0_0_20px_rgba(99,102,241,0.25)]
            ">

                {/* Icon */}
                <Search
                    size={16}
                    className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400"
                />

                <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search parking lots..."
                    className="
                        bg-transparent
                        pl-10 pr-4
                        py-3
                        w-80
                        text-sm
                        text-white
                        placeholder:text-neutral-500
                        outline-none
                        rounded-xl
                    "
                />
            </div>

            {/* Filter Button */}
            <button
                className="
                    flex items-center gap-2
                    backdrop-blur-xl
                    bg-white/[0.04]
                    border border-white/10
                    px-4 py-3
                    rounded-xl
                    text-sm
                    text-neutral-300
                    transition-all duration-300
                    hover:bg-white/[0.08]
                    hover:border-white/20
                    hover:shadow-[0_10px_30px_rgba(0,0,0,0.5)]
                "
            >
                <SlidersHorizontal size={16} />
                Filters
            </button>

        </div>
    )
}
