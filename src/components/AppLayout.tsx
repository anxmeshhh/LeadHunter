import { Outlet } from "react-router-dom";
import Sidebar from "./Sidebar";
import AICoach from "./AICoach";

export default function AppLayout() {
  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      <main className="ml-[260px] transition-all duration-300">
        <Outlet />
      </main>
      {/* AI Coach — floats bottom-right on every page */}
      <AICoach />
    </div>
  );
}