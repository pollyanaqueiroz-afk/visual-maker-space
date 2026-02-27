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
import ClientReviewPage from "./pages/ClientReviewPage";
import ClientAssetsPage from "./pages/ClientAssetsPage";
import SchedulingPage from "./pages/SchedulingPage";
import MeetingsDashboard from "./pages/MeetingsDashboard";

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
              <Route index element={<Navigate to="briefings" replace />} />
              <Route path="briefings" element={<Dashboard />} />
              <Route path="agendamento" element={<SchedulingPage />} />
              <Route path="dashboards" element={<MeetingsDashboard />} />
            </Route>
            {/* Legacy route redirect */}
            <Route path="/dashboard" element={<Navigate to="/hub/briefings" replace />} />
            <Route path="/delivery/:token" element={<DeliveryPage />} />
            <Route path="/designer" element={<DesignerPanel />} />
            <Route path="/client-review" element={<ClientReviewPage />} />
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
