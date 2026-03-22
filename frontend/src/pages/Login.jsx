import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { ParkingSquare, Eye, EyeOff } from "lucide-react"
import api from "../services/api"

export default function Login() {
    const navigate = useNavigate()

    const [username, setUsername] = useState("")
    const [password, setPassword] = useState("")
    const [showPassword, setShowPassword] = useState(false)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState("")

    const handleLogin = async (e) => {
        e.preventDefault()
        setLoading(true)
        setError("")

        try {
            const res = await api.post("/auth/login", { username, password })
            localStorage.setItem("token", res.data.token)
            navigate("/")
        } catch (err) {
            setError(err.response?.data?.message || "Invalid credentials. Try again.")
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="min-h-screen bg-[#070D18] flex items-center justify-center relative overflow-hidden">

            {/* Dot grid pattern */}
            <div className="absolute inset-0 dot-grid pointer-events-none" />

            {/* Ambient glows */}
            <div className="absolute -top-40 left-1/4 w-[600px] h-[600px] bg-indigo-600/15 blur-[120px] rounded-full pointer-events-none" />
            <div className="absolute -bottom-40 right-1/4 w-[500px] h-[500px] bg-cyan-500/10 blur-[120px] rounded-full pointer-events-none" />

            <div className="relative z-10 w-full max-w-sm px-4">

                {/* Logo mark */}
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-12 h-12 bg-indigo-600 rounded-2xl mb-4 shadow-lg shadow-indigo-500/40">
                        <ParkingSquare size={22} className="text-white" />
                    </div>
                    <h1 className="text-2xl font-semibold text-white tracking-tight">SmartPark</h1>
                    <p className="text-neutral-500 text-sm mt-1">Admin Dashboard</p>
                </div>

                {/* Card */}
                <div className="backdrop-blur-2xl bg-white/[0.04] border border-white/[0.08] rounded-2xl p-7 shadow-2xl">

                    <div className="mb-6">
                        <h2 className="text-lg font-semibold text-white">Sign in</h2>
                        <p className="text-neutral-500 text-sm mt-0.5">Enter your admin credentials to continue</p>
                    </div>

                    <form onSubmit={handleLogin} className="space-y-4">

                        {/* Username */}
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-medium text-neutral-400 uppercase tracking-widest">
                                Username
                            </label>
                            <input
                                type="text"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                placeholder="admin"
                                required
                                autoComplete="username"
                                className="
                                    w-full px-4 py-3 text-sm text-white
                                    bg-white/[0.04] border border-white/[0.08] rounded-xl
                                    placeholder:text-neutral-600
                                    outline-none
                                    focus:border-indigo-500/60 focus:ring-1 focus:ring-indigo-500/20
                                    transition-all duration-200
                                "
                            />
                        </div>

                        {/* Password */}
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-medium text-neutral-400 uppercase tracking-widest">
                                Password
                            </label>
                            <div className="relative">
                                <input
                                    type={showPassword ? "text" : "password"}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="••••••••"
                                    required
                                    autoComplete="current-password"
                                    className="
                                        w-full px-4 py-3 pr-11 text-sm text-white
                                        bg-white/[0.04] border border-white/[0.08] rounded-xl
                                        placeholder:text-neutral-600
                                        outline-none
                                        focus:border-indigo-500/60 focus:ring-1 focus:ring-indigo-500/20
                                        transition-all duration-200
                                    "
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword((s) => !s)}
                                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-neutral-300 transition-colors"
                                >
                                    {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                                </button>
                            </div>
                        </div>

                        {/* Error */}
                        {error && (
                            <div className="px-4 py-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-400 text-sm">
                                {error}
                            </div>
                        )}

                        {/* Submit */}
                        <button
                            type="submit"
                            disabled={loading}
                            className="
                                w-full mt-1 py-3 px-4
                                bg-indigo-600 hover:bg-indigo-500
                                text-white text-sm font-medium
                                rounded-xl
                                transition-all duration-200
                                disabled:opacity-60 disabled:cursor-not-allowed
                                shadow-lg shadow-indigo-500/20
                                flex items-center justify-center gap-2
                                cursor-pointer
                            "
                        >
                            {loading ? (
                                <>
                                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                    </svg>
                                    Signing in...
                                </>
                            ) : "Sign in"}
                        </button>

                    </form>
                </div>

                <p className="text-center text-[11px] text-neutral-600 mt-6">
                    SmartPark Admin Portal · Secure Access
                </p>

            </div>
        </div>
    )
}
