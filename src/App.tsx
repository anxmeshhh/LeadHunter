import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

import { AuthProvider, ProtectedRoute } from "./hooks/useAuth";
import AppLayout from "./components/AppLayout";

// Public pages
import Login  from "./pages/Login";
import Signup from "./pages/Signup";

// Protected pages
import Dashboard    from "./pages/Dashboard";
import Leads        from "./pages/Leads";
import LeadDetail   from "./pages/LeadDetail";
import Pipeline     from "./pages/Pipeline";
import Discover     from "./pages/Discover";
import Outreach     from "./pages/Outreach";
import Proposals    from "./pages/Proposals";
import Analytics    from "./pages/Analytics";
import CalendarPage from "./pages/CalendarPage";
import Tags         from "./pages/Tags";
import Settings     from "./pages/Settings";
import NotFound     from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>

            {/* ── Public routes ── */}
            <Route path="/login"  element={<Login />}  />
            <Route path="/signup" element={<Signup />} />

            {/* ── Protected routes ── */}
            <Route element={<ProtectedRoute />}>
              <Route element={<AppLayout />}>
                <Route path="/"          element={<Dashboard />}    />
                <Route path="/discover"  element={<Discover />}     />
                <Route path="/leads"     element={<Leads />}        />
                <Route path="/leads/:id" element={<LeadDetail />}   />
                <Route path="/pipeline"  element={<Pipeline />}     />
                <Route path="/outreach"  element={<Outreach />}     />
                <Route path="/proposals" element={<Proposals />}    />
                <Route path="/analytics" element={<Analytics />}    />
                <Route path="/calendar"  element={<CalendarPage />} />
                <Route path="/tags"      element={<Tags />}         />
                <Route path="/settings"  element={<Settings />}     />
                <Route path="*"          element={<NotFound />}     />
              </Route>
            </Route>

            {/* Fallback */}
            <Route path="*" element={<Navigate to="/login" replace />} />

          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;