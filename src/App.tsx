import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { PermissionsProvider } from "@/hooks/usePermissions";
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
import ClientDetailPage from "./pages/ClientDetailPage";
import AdminUsersPage from "./pages/AdminUsersPage";
import KanbanPage from "./pages/KanbanPage";
import KanbanBoardsPage from "./pages/KanbanBoardsPage";
import PermissionsPage from "./pages/PermissionsPage";
import PermissionGuard from "./components/PermissionGuard";
import AplicativosPage from "./pages/AplicativosPage";
import AplicativoDetailPage from "./pages/AplicativoDetailPage";
import AppClientPortal from "./pages/AppClientPortal";
import ClienteLogin from "./pages/cliente/ClienteLogin";
import ClienteHubLayout from "./pages/cliente/ClienteHubLayout";
import ClienteHome from "./pages/cliente/ClienteHome";
import ClienteArtes from "./pages/cliente/ClienteArtes";
import ClienteApp from "./pages/cliente/ClienteApp";
import ClienteSolicitar from "./pages/cliente/ClienteSolicitar";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <PermissionsProvider>
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
              <Route path="briefings" element={<PermissionGuard permission="briefings.view"><Dashboard /></PermissionGuard>} />
              <Route path="agendamento" element={<PermissionGuard permission="agendamento.view"><SchedulingPage /></PermissionGuard>} />
              <Route path="dashboards" element={<PermissionGuard permission="dashboards.view"><MeetingsDashboard /></PermissionGuard>} />
              <Route path="carteira" element={<PermissionGuard permission="carteira.view"><CarteiraGeralPage /></PermissionGuard>} />
              <Route path="carteira/:clientId" element={<PermissionGuard permission="carteira.view"><ClientDetailPage /></PermissionGuard>} />
              <Route path="kanban" element={<PermissionGuard permission="kanban.view"><KanbanBoardsPage /></PermissionGuard>} />
              <Route path="kanban/:boardId" element={<PermissionGuard permission="kanban.view"><KanbanPage /></PermissionGuard>} />
              <Route path="lideranca" element={<PermissionGuard permission="lideranca.view"><LeadershipDashboard /></PermissionGuard>} />
              <Route path="admin/usuarios" element={<PermissionGuard permission="admin.view"><AdminUsersPage /></PermissionGuard>} />
              <Route path="admin/permissoes" element={<PermissionGuard permission="admin.manage_permissions"><PermissionsPage /></PermissionGuard>} />
              <Route path="aplicativos" element={<PermissionGuard permission="aplicativos.view"><AplicativosPage /></PermissionGuard>} />
              <Route path="aplicativos/:clienteId" element={<PermissionGuard permission="aplicativos.view"><AplicativoDetailPage /></PermissionGuard>} />
            </Route>
            {/* Legacy route redirect */}
            <Route path="/dashboard" element={<Navigate to="/hub/briefings" replace />} />
            <Route path="/delivery/:token" element={<DeliveryPage />} />
            <Route path="/designer" element={<DesignerPanel />} />
            <Route path="/client-review" element={<ClientReviewPage />} />
            <Route path="/csat/:token" element={<CsatPage />} />
            <Route path="/assets/:platformUrl" element={<ClientAssetsPage />} />
            <Route path="/app/:token" element={<AppClientPortal />} />
            {/* Client Hub */}
            <Route path="/cliente/login" element={<ClienteLogin />} />
            <Route path="/cliente" element={<ClienteHubLayout />}>
              <Route index element={<ClienteHome />} />
              <Route path="artes" element={<ClienteArtes />} />
              <Route path="aplicativo" element={<ClienteApp />} />
              <Route path="solicitar" element={<ClienteSolicitar />} />
            </Route>
            <Route path="*" element={<NotFound />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
      </PermissionsProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
