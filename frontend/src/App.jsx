import { BrowserRouter, Routes, Route } from "react-router-dom"
import AppLayout from "./app/AppLayout"
import { routes } from "./app/routes"
import Login from "./pages/Login"

export default function App() {
  return (
    <BrowserRouter>
      <Routes>

        {/* Public Route */}
        <Route path="/login" element={<Login />} />

        {/* Protected Layout Routes */}
        <Route element={<AppLayout />}>
          {routes.map((route) => (
            <Route
              key={route.path}
              path={route.path}
              element={route.element}
            />
          ))}
        </Route>

      </Routes>
    </BrowserRouter>
  )
}
