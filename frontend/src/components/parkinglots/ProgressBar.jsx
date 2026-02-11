import { useEffect, useState } from "react"

export default function ProgressBar({ value = 0 }) {
    const [width, setWidth] = useState(0)

    useEffect(() => {
        const timeout = setTimeout(() => {
            setWidth(value)
        }, 100)

        return () => clearTimeout(timeout)
    }, [value])

    const getGradient = () => {
        if (value > 80) {
            return "from-rose-500 to-red-600"
        }
        if (value > 60) {
            return "from-amber-400 to-yellow-500"
        }
        return "from-indigo-500 to-cyan-400"
    }

    return (
        <div className="
            relative
            w-full
            h-3
            rounded-full
            overflow-hidden
            backdrop-blur-md
            bg-white/5
            border border-white/10
        ">

            {/* Animated Fill */}
            <div
                className={`
                    h-full
                    bg-gradient-to-r ${getGradient()}
                    transition-all duration-1000 ease-out
                    relative
                `}
                style={{
                    width: `${width}%`
                }}
            >

                {/* Inner Glow */}
                <div className="
                    absolute inset-0
                    opacity-40
                    blur-sm
                    bg-white/20
                " />

                {/* Shimmer Sweep */}
                <div className="
                    absolute top-0 left-0 h-full w-full
                    opacity-0 hover:opacity-100
                    transition duration-700
                ">
                    <div className="
                        absolute -left-1/2 top-0 h-full w-1/3
                        bg-gradient-to-r from-transparent via-white/30 to-transparent
                        skew-x-[-20deg]
                        animate-progress-shimmer
                    " />
                </div>

            </div>
        </div>
    )
}
