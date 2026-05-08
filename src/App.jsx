import { Toaster } from "@/components/ui/toaster"
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { ThemeProvider } from '@/lib/ThemeContext';
// Add page imports here
import Home from './pages/Home';
// Simulator and ScenarioBuilder fully removed; legacy code deleted for safety.
import Capabilities from './pages/Capabilities';
import QATwin from './pages/QATwin';
import AdminDashboard from './pages/AdminDashboard';
import ScenarioLibrary from './pages/ScenarioLibrary';
import PredictiveBuilder from './pages/PredictiveBuilder';
import PredictiveBuilderReferences from './pages/PredictiveBuilderReferences';
// import AdaptiveRpsPage from './features/rps/AdaptiveRpsPage';
import EnterpriseRpsGateway from './enterprise-rps-gateway/EnterpriseRpsGateway';
// import RolePlaySimulator from './pages/RolePlaySimulator';

function ExternalRpsRedirect() {
  window.location.replace('https://rps.reflectiv-ai.com/');
  return null;
}

const AppRoutes = () => {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      {/* Legacy simulator and builder routes permanently removed. */}
      <Route path="/capabilities" element={<Capabilities />} />
      <Route path="/qa" element={<QATwin />} />
      <Route path="/admin" element={<AdminDashboard />} />
      <Route path="/library" element={<ScenarioLibrary />} />
      <Route path="/predictive-builder" element={<PredictiveBuilder />} />
      <Route path="/predictive-builder/references" element={<PredictiveBuilderReferences />} />
      {/* <Route path="/rps-adaptive" element={<AdaptiveRpsPage />} /> */}
      {/* Redirect all RPS routes to the standalone RPS site */}
      <Route path="/rps" element={<ExternalRpsRedirect />} />
      <Route path="/RolePlaySimulator" element={<ExternalRpsRedirect />} />
      <Route path="/simulator" element={<ExternalRpsRedirect />} />
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
