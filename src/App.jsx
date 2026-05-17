import { Toaster } from "@/components/ui/toaster"
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { ThemeProvider } from '@/lib/ThemeContext';
// Add page imports here
import Home from './pages/Home';
// import Simulator from './pages/Simulator';
import ScenarioBuilder from './pages/ScenarioBuilder';
import Capabilities from './pages/Capabilities';
import QATwin from './pages/QATwin';
import AdminDashboard from './pages/AdminDashboard';
import ScenarioLibrary from './pages/ScenarioLibrary';
import PredictiveBuilder from './pages/PredictiveBuilder';
import PredictiveBuilderReferences from './pages/PredictiveBuilderReferences';
import AdaptiveRpsPage from './features/rps/AdaptiveRpsPage';
import EnterpriseRpsGateway from './enterprise-rps-gateway/EnterpriseRpsGateway';
import PreCallPlanning from './pages/PreCallPlanning';
// import RolePlaySimulator from './pages/RolePlaySimulator';
import Simulator from './pages/Simulator';

function ExternalRpsRedirect() {
  if (typeof window !== "undefined") {
    const host = window.location.hostname;
    const isLocal = host === "localhost" || host === "127.0.0.1";
    if (isLocal) {
      window.location.replace('/simulator');
      return null;
    }
  }
  window.location.replace('https://rps.reflectiv-ai.com/');
  return null;
}

const AppRoutes = () => {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/simulator" element={<ThemeProvider><Simulator /></ThemeProvider>} />
      <Route path="/simulator/*" element={<ThemeProvider><Simulator /></ThemeProvider>} />
      <Route path="/builder" element={<ScenarioBuilder />} />
      <Route path="/capabilities" element={<Capabilities />} />
      <Route path="/qa" element={<QATwin />} />
      <Route path="/admin" element={<AdminDashboard />} />
      <Route path="/library" element={<ScenarioLibrary />} />
      <Route path="/predictive-builder" element={<PredictiveBuilder />} />
      <Route path="/predictive-builder/references" element={<PredictiveBuilderReferences />} />
      <Route path="/PreCallPlanning" element={<PreCallPlanning />} />
      <Route path="/pre-call-planning" element={<PreCallPlanning />} />
      <Route path="/rps-adaptive" element={<AdaptiveRpsPage />} />
      {/* Redirect all RPS routes to the standalone RPS site */}
      <Route path="/rps" element={<ExternalRpsRedirect />} />
      <Route path="/RolePlaySimulator" element={<ThemeProvider><Simulator /></ThemeProvider>} />
      <Route path="/RolePlaySimulator/*" element={<ThemeProvider><Simulator /></ThemeProvider>} />
      <Route path="/role-play-simulator" element={<ThemeProvider><Simulator /></ThemeProvider>} />
      <Route path="/role-play-simulator/*" element={<ThemeProvider><Simulator /></ThemeProvider>} />
      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
};


function App() {

  return (
    <>
      <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <AppRoutes />
      </Router>
      <Toaster />
    </>
  )
}

export default App
