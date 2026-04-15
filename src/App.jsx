import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { ThemeProvider } from '@/lib/ThemeContext';
// Add page imports here
import Home from './pages/Home';
import Simulator from './pages/Simulator';
import ScenarioBuilder from './pages/ScenarioBuilder';
import Capabilities from './pages/Capabilities';
import QATwin from './pages/QATwin';
import AdminDashboard from './pages/AdminDashboard';
import ScenarioLibrary from './pages/ScenarioLibrary';

const AppRoutes = () => {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/simulator" element={<ThemeProvider><Simulator /></ThemeProvider>} />
      <Route path="/builder" element={<ScenarioBuilder />} />
      <Route path="/capabilities" element={<Capabilities />} />
      <Route path="/qa" element={<QATwin />} />
      <Route path="/admin" element={<AdminDashboard />} />
      <Route path="/library" element={<ScenarioLibrary />} />
      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
};


function App() {

  return (
    <QueryClientProvider client={queryClientInstance}>
      <Router>
        <AppRoutes />
      </Router>
      <Toaster />
    </QueryClientProvider>
  )
}

export default App
