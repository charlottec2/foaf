import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { RequireAuth } from "@/components/RequireAuth";
import Auth from "./pages/Auth";
import Home from "./pages/Home";
import Gather from "./pages/Gather";
import NewGather from "./pages/NewGather";
import GatherPage from "./pages/GatherPage";
import Groups from "./pages/Groups";
import GroupPage from "./pages/GroupPage";
import Circle from "./pages/Circle";
import UserProfile from "./pages/UserProfile";
import Me from "./pages/Me";
import NotFound from "./pages/NotFound.tsx";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner position="top-center" />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/auth" element={<Auth />} />
            <Route path="/" element={<RequireAuth><Home /></RequireAuth>} />
            <Route path="/gather" element={<RequireAuth><Gather /></RequireAuth>} />
            <Route path="/gather/new" element={<RequireAuth><NewGather /></RequireAuth>} />
            <Route path="/g/:id" element={<RequireAuth><GatherPage /></RequireAuth>} />
            <Route path="/groups" element={<RequireAuth><Groups /></RequireAuth>} />
            <Route path="/groups/:id" element={<RequireAuth><GroupPage /></RequireAuth>} />
            <Route path="/circle" element={<RequireAuth><Circle /></RequireAuth>} />
            <Route path="/u/:handle" element={<RequireAuth><UserProfile /></RequireAuth>} />
            <Route path="/me" element={<RequireAuth><Me /></RequireAuth>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
