import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { RequireAuth } from "@/components/RequireAuth";
import Auth from "./pages/Auth";
import Feed from "./pages/Feed";
import NewInitiative from "./pages/NewInitiative";
import InitiativePage from "./pages/InitiativePage";
import Connections from "./pages/Connections";
import UserProfile from "./pages/UserProfile";
import Me from "./pages/Me";
import NotFound from "./pages/NotFound.tsx";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner theme="dark" position="top-center" />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/auth" element={<Auth />} />
            <Route path="/" element={<RequireAuth><Feed /></RequireAuth>} />
            <Route path="/new" element={<RequireAuth><NewInitiative /></RequireAuth>} />
            <Route path="/i/:id" element={<RequireAuth><InitiativePage /></RequireAuth>} />
            <Route path="/connections" element={<RequireAuth><Connections /></RequireAuth>} />
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
