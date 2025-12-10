import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";
import Navigation from "@/components/Navigation";
import SalesPage from "@/components/SalesPage";
import DebtPage from "@/components/DebtPage";
import SettingsPage from "@/components/SettingsPage";
import AnalyticsDashboard from "@/components/AnalyticsDashboard";
import ExpenseTracking from "@/components/ExpenseTracking";

const Dashboard = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState("analytics");
  const navigate = useNavigate();

  useEffect(() => {
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        navigate("/auth");
        return;
      }

      setUser(session.user);
      setLoading(false);
    };

    checkUser();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        navigate("/auth");
      } else {
        setUser(session.user);
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-lg">Loading...</p>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="min-h-screen bg-background">
      <Navigation currentPage={currentPage} setCurrentPage={setCurrentPage} user={user} />
      <div className="container mx-auto py-5 px-4 max-w-7xl">
        {currentPage === "analytics" && <AnalyticsDashboard userId={user.id} />}
        {currentPage === "sales" && <SalesPage userId={user.id} />}
        {currentPage === "expenses" && <ExpenseTracking userId={user.id} />}
        {currentPage === "debt" && <DebtPage userId={user.id} />}
        {currentPage === "settings" && <SettingsPage userId={user.id} />}
      </div>
    </div>
  );
};

export default Dashboard;
