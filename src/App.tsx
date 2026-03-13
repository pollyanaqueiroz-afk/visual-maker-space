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
import DesignerLogin from "./pages/DesignerLogin";
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
import PermissionsPage from "./pages/PermissionsPage";
import PermissionGuard from "./components/PermissionGuard";
import FieldManagementPage from "./pages/FieldManagementPage";
import AplicativosPage from "./pages/AplicativosPage";
import AplicativoDetailPage from "./pages/AplicativoDetailPage";
import AppClientPortal from "./pages/AppClientPortal";
import FunilCancelamentoPage from "./pages/FunilCancelamentoPage";
import ScormManagerPage from "./pages/ScormManagerPage";
import ScormPlayerPage from "./pages/ScormPlayerPage";
import BIDashboardPage from "./pages/BIDashboardPage";
import ChurnPage from "./pages/ChurnPage";
import UpsellPage from "./pages/UpsellPage";
import ReversaoCancelamentoPage from "./pages/ReversaoCancelamentoPage";
import ClientesInativosPage from "./pages/ClientesInativosPage";
import AuditoriaPage from "./pages/AuditoriaPage";
import PipelinePage from "./pages/PipelinePage";
import ProcessosImplantacaoPage from "./pages/ProcessosImplantacaoPage";
import GestaoGerencialPage from "./pages/GestaoGerencialPage";
import AjusteBriefingsPage from "./pages/AjusteBriefingsPage";
import AjusteAplicativosPage from "./pages/AjusteAplicativosPage";
import CarteirizacaoPage from "./pages/CarteirizacaoPage";
import ApiDocsPage from "./pages/ApiDocsPage";
import MigracaoKanbanPage from "./pages/MigracaoKanbanPage";
import MigracaoAjustesPage from "./pages/MigracaoAjustesPage";
import MigracaoAnalyticsPage from "./pages/MigracaoAnalyticsPage";
import EmailReportPage from "./pages/EmailReportPage";
import ErrorCentralPage from "./pages/ErrorCentralPage";
import ProdutoInsightsPage from "./pages/ProdutoInsightsPage";
import ProdutoEntregasPage from "./pages/ProdutoEntregasPage";
import ClienteLogin from "./pages/cliente/ClienteLogin";
import ClienteHubLayout from "./pages/cliente/ClienteHubLayout";
import ClienteHome from "./pages/cliente/ClienteHome";
import ClienteArtes from "./pages/cliente/ClienteArtes";
import ClienteApp from "./pages/cliente/ClienteApp";
import ClienteSolicitar from "./pages/cliente/ClienteSolicitar";
import ClienteSolicitarApp from "./pages/cliente/ClienteSolicitarApp";
import ClienteScorm from "./pages/cliente/ClienteScorm";
import ClienteMigracao from "./pages/cliente/ClienteMigracao";
import ClientePreviewWrapper from "./pages/cliente/ClientePreviewWrapper";
import ClienteMigracaoPublic from "./pages/cliente/ClienteMigracaoPublic";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error: any) => {
        if (error?.status >= 400 && error?.status < 500) return false;
        return failureCount < 2;
      },
      staleTime: 30_000,
    },
  },
});

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
              <Route path="lideranca" element={<PermissionGuard permission="lideranca.view"><LeadershipDashboard /></PermissionGuard>} />
              <Route path="admin/usuarios" element={<PermissionGuard permission="admin.view"><AdminUsersPage /></PermissionGuard>} />
              <Route path="admin/permissoes" element={<PermissionGuard permission="admin.manage_permissions"><PermissionsPage /></PermissionGuard>} />
              <Route path="admin/campos" element={<PermissionGuard permission="carteira.manage_fields"><FieldManagementPage /></PermissionGuard>} />
              <Route path="admin/gerencial" element={<PermissionGuard permission="admin.view"><GestaoGerencialPage /></PermissionGuard>} />
              <Route path="admin/api-docs" element={<PermissionGuard permission="admin.view"><ApiDocsPage /></PermissionGuard>} />
              <Route path="admin/erros" element={<PermissionGuard permission="admin.view"><ErrorCentralPage /></PermissionGuard>} />
              <Route path="admin/carteirizacao" element={<PermissionGuard permission="admin.view"><CarteirizacaoPage /></PermissionGuard>} />
              <Route path="aplicativos" element={<PermissionGuard permission="aplicativos.view"><AplicativosPage /></PermissionGuard>} />
              <Route path="aplicativos/:clienteId" element={<PermissionGuard permission="aplicativos.view"><AplicativoDetailPage /></PermissionGuard>} />
              <Route path="funil-cancelamento" element={<PermissionGuard permission="funil.view"><FunilCancelamentoPage /></PermissionGuard>} />
              <Route path="scorm" element={<PermissionGuard permission="scorm.view"><ScormManagerPage /></PermissionGuard>} />
              <Route path="bi" element={<PermissionGuard permission="dashboards.view"><BIDashboardPage /></PermissionGuard>} />
              <Route path="churn" element={<PermissionGuard permission="dashboards.view"><ChurnPage /></PermissionGuard>} />
              <Route path="upsell" element={<PermissionGuard permission="dashboards.view"><UpsellPage /></PermissionGuard>} />
              <Route path="reversao" element={<PermissionGuard permission="funil.view"><ReversaoCancelamentoPage /></PermissionGuard>} />
              <Route path="inativos" element={<PermissionGuard permission="dashboards.view"><ClientesInativosPage /></PermissionGuard>} />
              <Route path="auditoria" element={<PermissionGuard permission="admin.view"><AuditoriaPage /></PermissionGuard>} />
              <Route path="pipeline" element={<PermissionGuard permission="admin.view"><PipelinePage /></PermissionGuard>} />
              <Route path="processos-implantacao" element={<PermissionGuard permission="carteira.view"><ProcessosImplantacaoPage /></PermissionGuard>} />
              <Route path="email-report" element={<PermissionGuard permission="briefings.view"><EmailReportPage /></PermissionGuard>} />
              <Route path="ajuste-briefings" element={<PermissionGuard permission="briefings.view"><AjusteBriefingsPage /></PermissionGuard>} />
              <Route path="ajuste-aplicativos" element={<PermissionGuard permission="aplicativos.view"><AjusteAplicativosPage /></PermissionGuard>} />
              <Route path="migracao" element={<PermissionGuard permission="migracao.view"><MigracaoKanbanPage /></PermissionGuard>} />
              <Route path="migracao/ajustes" element={<PermissionGuard permission="migracao.view"><MigracaoAjustesPage /></PermissionGuard>} />
              <Route path="migracao/analytics" element={<PermissionGuard permission="migracao.view"><MigracaoAnalyticsPage /></PermissionGuard>} />
              <Route path="produto" element={<PermissionGuard permission="carteira.view"><ProdutoInsightsPage /></PermissionGuard>} />
              <Route path="produto/entregas" element={<PermissionGuard permission="carteira.view"><ProdutoEntregasPage /></PermissionGuard>} />
            </Route>
            {/* CS Client Preview (impersonation) - outside hub layout */}
            <Route path="/hub/cliente-preview/:clienteId" element={<ClientePreviewWrapper />}>
              <Route index element={<ClienteHome />} />
              <Route path="artes" element={<ClienteArtes />} />
              <Route path="aplicativo" element={<ClienteApp />} />
              <Route path="scorm" element={<ClienteScorm />} />
            </Route>
            {/* Legacy route redirect */}
            <Route path="/dashboard" element={<Navigate to="/hub/briefings" replace />} />
            <Route path="/delivery/:token" element={<DeliveryPage />} />
            <Route path="/designer/login" element={<DesignerLogin />} />
            <Route path="/designer" element={<DesignerPanel />} />
            <Route path="/client-review" element={<ClientReviewPage />} />
            <Route path="/csat/:token" element={<CsatPage />} />
            <Route path="/assets/:platformUrl" element={<ClientAssetsPage />} />
            <Route path="/app/:token" element={<AppClientPortal />} />
            <Route path="/scorm/:id" element={<ScormPlayerPage />} />
            <Route path="/migracao/:token" element={<ClienteMigracaoPublic />} />
            {/* Client Hub */}
            <Route path="/cliente/login" element={<ClienteLogin />} />
            <Route path="/cliente" element={<ClienteHubLayout />}>
              <Route index element={<ClienteHome />} />
              <Route path="artes" element={<ClienteArtes />} />
              <Route path="aplicativo" element={<ClienteApp />} />
              <Route path="solicitar" element={<ClienteSolicitar />} />
              <Route path="solicitar-app" element={<ClienteSolicitarApp />} />
              <Route path="scorm" element={<ClienteScorm />} />
              <Route path="migracao" element={<ClienteMigracao />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
      </PermissionsProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
