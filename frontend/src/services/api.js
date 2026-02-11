import axios from "axios"

const api = axios.create({
    baseURL: "https://smart-parking-system-vk73.onrender.com/api",
})

// 🔐 Attach token automatically
api.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem("token")

        if (token) {
            config.headers.Authorization = `Bearer ${token}`
        }

        return config
    },
    (error) => Promise.reject(error)
)

// 🚨 Handle expired token globally
api.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response?.status === 401) {
            localStorage.removeItem("token")
            window.location.href = "/login"
        }

        return Promise.reject(error)
    }
)

export default api
