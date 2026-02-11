import Dashboard from "../pages/Dashboard"
import ParkingSlots from "../pages/ParkingSlots"
import ParkingLots from "../pages/ParkingLots"
import ParkingSessions from "../pages/ParkingSessions"
import Vehicles from "../pages/Vehicles"
import Analytics from "../pages/Analytics"
import Settings from "../pages/Settings"
import Login from "../pages/Login"
import ProtectedRoute from "../components/ProtectedRoute"

export const routes = [

    {
        path: "/",
        element: (
            <ProtectedRoute>
                <Dashboard />
            </ProtectedRoute>
        ),
    },
    {
        path: "/slots/:lotId",
        element: (
            <ProtectedRoute>
                <ParkingSlots />
            </ProtectedRoute>
        ),
    },
    {
        path: "/lots",
        element: (
            <ProtectedRoute>
                <ParkingLots />
            </ProtectedRoute>
        ),
    },
    {
        path: "/sessions",
        element: (
            <ProtectedRoute>
                <ParkingSessions />
            </ProtectedRoute>
        ),
    },
    {
        path: "/vehicles",
        element: (
            <ProtectedRoute>
                <Vehicles />
            </ProtectedRoute>
        ),
    },
    {
        path: "/analytics",
        element: (
            <ProtectedRoute>
                <Analytics />
            </ProtectedRoute>
        ),
    },
    {
        path: "/settings",
        element: (
            <ProtectedRoute>
                <Settings />
            </ProtectedRoute>
        ),
    },
]
