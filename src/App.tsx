import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/lib/auth";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import Landing from "./pages/Landing";
import Auth from "./pages/Auth";
import Install from "./pages/Install";
import { AppShell } from "./components/layout/AppShell";

import Chat from "./pages/app/Chat";
import Checkin from "./pages/app/Checkin";
import Graph from "./pages/app/Graph";
import Dashboard from "./pages/app/Dashboard";
import Mirror from "./pages/app/Mirror";
import Sleep from "./pages/app/Sleep";
import { Navigate } from "react-router-dom";
import Feed from "./pages/app/Feed";
import DMs from "./pages/app/DMs";
import Progress from "./pages/app/Progress";
import Learn from "./pages/app/Learn";
import Settings from "./pages/app/Settings";
import Notifications from "./pages/app/Notifications";
import Ping from "./pages/app/Ping";
import NotFound from "./pages/NotFound.tsx";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/install" element={<Install />} />
            <Route
              path="/app"
              element={
                <ProtectedRoute>
                  <AppShell />
                </ProtectedRoute>
              }
            >
              <Route index element={<Mirror />} />
              <Route path="glyph" element={<Navigate to="/app" replace />} />
              <Route path="chat" element={<Chat />} />
              <Route path="checkin" element={<Navigate to="/app?tab=today" replace />} />
              <Route path="graph" element={<Graph />} />
              <Route path="dashboard" element={<Navigate to="/app?tab=analytics" replace />} />
              <Route path="mirror" element={<Mirror />} />
              <Route path="sleep" element={<Sleep />} />
              <Route path="feed" element={<Feed />} />
              <Route path="dms" element={<DMs />} />
              <Route path="progress" element={<Navigate to="/app?tab=analytics" replace />} />
              <Route path="checkin-form" element={<Checkin />} />
              <Route path="dashboard-old" element={<Dashboard />} />
              <Route path="progress-old" element={<Progress />} />
              <Route path="learn" element={<Learn />} />
              <Route path="settings" element={<Settings />} />
              <Route path="notifications" element={<Notifications />} />
              <Route path="ping" element={<Ping />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
