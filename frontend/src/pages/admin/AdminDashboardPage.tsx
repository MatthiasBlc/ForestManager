import { useEffect, useState } from "react";
import { DashboardStats } from "../../models/admin";
import APIManager from "../../network/api";

function AdminDashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadStats() {
      try {
        const data = await APIManager.getAdminDashboardStats();
        setStats(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load dashboard");
      } finally {
        setIsLoading(false);
      }
    }
    loadStats();
  }, []);

  return (
    <div>
      <h1 className="text-3xl font-bold mb-6">Dashboard</h1>

      {error && (
        <div className="alert alert-error mb-6">
          <span>{error}</span>
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-12">
          <span className="loading loading-spinner loading-lg"></span>
        </div>
      ) : stats ? (
        <>
          {/* Total Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
            <StatCard title="Users" value={stats.totals.users} />
            <StatCard title="Communities" value={stats.totals.communities} />
            <StatCard title="Recipes" value={stats.totals.recipes} />
            <StatCard title="Tags" value={stats.totals.tags} />
            <StatCard title="Ingredients" value={stats.totals.ingredients} />
            <StatCard title="Features" value={stats.totals.features} />
          </div>

          {/* Weekly Stats */}
          <h2 className="text-xl font-semibold mb-4">Last 7 days</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            <StatCard title="New Users" value={stats.lastWeek.newUsers} variant="success" />
            <StatCard title="New Communities" value={stats.lastWeek.newCommunities} variant="success" />
            <StatCard title="New Recipes" value={stats.lastWeek.newRecipes} variant="success" />
          </div>

          {/* Top Communities */}
          <h2 className="text-xl font-semibold mb-4">Top Communities</h2>
          <div className="card bg-base-100 shadow">
            <div className="overflow-x-auto">
              <table className="table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th className="text-right">Members</th>
                    <th className="text-right">Recipes</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.topCommunities.length > 0 ? (
                    stats.topCommunities.map((community) => (
                      <tr key={community.id}>
                        <td className="font-medium">{community.name}</td>
                        <td className="text-right">{community.memberCount}</td>
                        <td className="text-right">{community.recipeCount}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={3} className="text-center text-base-content/50">
                        No communities yet
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}

interface StatCardProps {
  title: string;
  value: number;
  variant?: "default" | "success";
}

function StatCard({ title, value, variant = "default" }: StatCardProps) {
  const bgClass = variant === "success" ? "bg-success/10" : "bg-base-100";
  const textClass = variant === "success" ? "text-success" : "text-primary";

  return (
    <div className={`card ${bgClass} shadow`}>
      <div className="card-body p-4">
        <div className="text-sm text-base-content/70">{title}</div>
        <div className={`text-3xl font-bold ${textClass}`}>{value}</div>
      </div>
    </div>
  );
}

export default AdminDashboardPage;
