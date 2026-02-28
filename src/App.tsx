import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import Login from "./pages/Login";
import BriefingForm from "./pages/BriefingForm";
import Dashboard from "./pages/Dashboard";
import DeliveryPage from "./pages/DeliveryPage";
import DesignerPanel from "./pages/DesignerPanel";
import HubPage from "./pages/HubPage";
import HubWelcome from "./pages/HubWelcome";
import ClientReviewPage from "./pages/ClientReviewPage";
import ClientAssetsPage from "./pages/ClientAssetsPage";
import SchedulingPage from "./pages/SchedulingPage";
import MeetingsDashboard from "./pages/MeetingsDashboard";
import LeadershipDashboard from "./pages/LeadershipDashboard";
import CarteiraGeralPage from "./pages/CarteiraGeralPage";
import CsatPage from "./pages/CsatPage";
import AdminUsersPage from "./pages/AdminUsersPage";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/briefing" element={<BriefingForm />} />
            <Route path="/login" element={<Login />} />
            <Route path="/hub" element={<HubPage />}>
              <Route index element={<HubWelcome />} />
              <Route path="briefings" element={<Dashboard />} />
              <Route path="agendamento" element={<SchedulingPage />} />
              <Route path="dashboards" element={<MeetingsDashboard />} />
              <Route path="carteira" element={<CarteiraGeralPage />} />
              <Route path="lideranca" element={<LeadershipDashboard />} />
            </Route>
            {/* Legacy route redirect */}
            <Route path="/dashboard" element={<Navigate to="/hub/briefings" replace />} />
            <Route path="/delivery/:token" element={<DeliveryPage />} />
            <Route path="/designer" element={<DesignerPanel />} />
            <Route path="/client-review" element={<ClientReviewPage />} />
            <Route path="/csat/:token" element={<CsatPage />} />
            <Route path="/assets/:platformUrl" element={<ClientAssetsPage />} />
            <Route path="*" element={<NotFound />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
