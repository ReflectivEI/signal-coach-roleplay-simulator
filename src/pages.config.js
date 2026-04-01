/**
 * pages.config.js - Page routing configuration
 * 
 * This file is AUTO-GENERATED. Do not add imports or modify PAGES manually.
 * Pages are auto-registered when you create files in the ./pages/ folder.
 * 
 * THE ONLY EDITABLE VALUE: mainPage
 * This controls which page is the landing page (shown when users visit the app).
 * 
 * Example file structure:
 * 
 *   import HomePage from './pages/HomePage';
 *   import Dashboard from './pages/Dashboard';
 *   import Settings from './pages/Settings';
 *   
 *   export const PAGES = {
 *       "HomePage": HomePage,
 *       "Dashboard": Dashboard,
 *       "Settings": Settings,
 *   }
 *   
 *   export const pagesConfig = {
 *       mainPage: "HomePage",
 *       Pages: PAGES,
 *   };
 * 
 * Example with Layout (wraps all pages):
 *
 *   import Home from './pages/Home';
 *   import Settings from './pages/Settings';
 *   import __Layout from './Layout.jsx';
 *
 *   export const PAGES = {
 *       "Home": Home,
 *       "Settings": Settings,
 *   }
 *
 *   export const pagesConfig = {
 *       mainPage: "Home",
 *       Pages: PAGES,
 *       Layout: __Layout,
 *   };
 *
 * To change the main page from HomePage to Dashboard, use find_replace:
 *   Old: mainPage: "HomePage",
 *   New: mainPage: "Dashboard",
 *
 * The mainPage value must match a key in the PAGES object exactly.
 */
import AICoach from './pages/AICoach';
import AuditSummary from './pages/AuditSummary';
import BehavioralMetrics from './pages/BehavioralMetrics';
import CoachingModules from './pages/CoachingModules';
import CustomizationIntegration from './pages/CustomizationIntegration';
import Dashboard from './pages/Dashboard';
import DataReports from './pages/DataReports';
import Download from './pages/Download';
import Exercises from './pages/Exercises';
import Frameworks from './pages/Frameworks';
import HelpCenter from './pages/HelpCenter';
import KnowledgeBase from './pages/KnowledgeBase';
import LearningPaths from './pages/LearningPaths';
import Login from './pages/Login';
import ManagerView from './pages/ManagerView';
import PerformanceAnalytics from './pages/PerformanceAnalytics';
import PreCallPlanning from './pages/PreCallPlanning';
import ProfileSettings from './pages/ProfileSettings';
import RolePlaySimulator from './pages/RolePlaySimulator';
import RolePlaySimulatorV2 from './pages/RolePlaySimulatorV2';
import RolePlaySimulatorSafe from './pages/RolePlaySimulatorSafe';
import ScenarioBuilder from './pages/ScenarioBuilder';
import __Layout from './Layout.jsx';


export const PAGES = {
    "AICoach": AICoach,
    "AuditSummary": AuditSummary,
    "BehavioralMetrics": BehavioralMetrics,
    "CoachingModules": CoachingModules,
    "CustomizationIntegration": CustomizationIntegration,
    "Dashboard": Dashboard,
    "DataReports": DataReports,
    "Download": Download,
    "Exercises": Exercises,
    "Frameworks": Frameworks,
    "HelpCenter": HelpCenter,
    "KnowledgeBase": KnowledgeBase,
    "LearningPaths": LearningPaths,
    "Login": Login,
    "ManagerView": ManagerView,
    "PerformanceAnalytics": PerformanceAnalytics,
    "PreCallPlanning": PreCallPlanning,
    "ProfileSettings": ProfileSettings,
    "RolePlaySimulator": RolePlaySimulator,
    "RolePlaySimulatorV2": RolePlaySimulatorV2,
    "RolePlaySimulatorSafe": RolePlaySimulatorSafe,
    "ScenarioBuilder": ScenarioBuilder,
}

export const pagesConfig = {
    mainPage: "Dashboard",
    Pages: PAGES,
    Layout: __Layout,
};
