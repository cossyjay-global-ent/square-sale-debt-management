import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "./ui/card";
import { Button } from "./ui/button";
import { format, subDays, startOfMonth, endOfMonth, subMonths } from "date-fns";
import { Printer, TrendingUp, TrendingDown, Minus, AlertTriangle, Users } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "./ui/alert";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
} from "recharts";

interface AnalyticsDashboardProps {
  userId: string;
}

interface MonthlyComparison {
  thisMonth: { revenue: number; profit: number; sales: number; expenses: number };
  lastMonth: { revenue: number; profit: number; sales: number; expenses: number };
}

const COLORS = ["hsl(var(--primary))", "hsl(var(--success))", "hsl(var(--warning))", "hsl(var(--info))"];

const AnalyticsDashboard = ({ userId }: AnalyticsDashboardProps) => {
  const [salesData, setSalesData] = useState<any[]>([]);
  const [debtData, setDebtData] = useState<any[]>([]);
  const [productStats, setProductStats] = useState<any[]>([]);
  const [monthlyComparison, setMonthlyComparison] = useState<MonthlyComparison>({
    thisMonth: { revenue: 0, profit: 0, sales: 0, expenses: 0 },
    lastMonth: { revenue: 0, profit: 0, sales: 0, expenses: 0 },
  });
  const [debtSummary, setDebtSummary] = useState({ outstanding: 0, collected: 0 });
  const [expenseSummary, setExpenseSummary] = useState({ total: 0, count: 0 });
  const [profitMarginGoal, setProfitMarginGoal] = useState(20);
  const [customerLoyalty, setCustomerLoyalty] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchAnalytics();
  }, [userId]);

  const fetchAnalytics = async () => {
    setLoading(true);
    const thirtyDaysAgo = format(subDays(new Date(), 30), "yyyy-MM-dd");
    const today = format(new Date(), "yyyy-MM-dd");

    // Monthly comparison dates
    const thisMonthStart = format(startOfMonth(new Date()), "yyyy-MM-dd");
    const thisMonthEnd = format(endOfMonth(new Date()), "yyyy-MM-dd");
    const lastMonthStart = format(startOfMonth(subMonths(new Date(), 1)), "yyyy-MM-dd");
    const lastMonthEnd = format(endOfMonth(subMonths(new Date(), 1)), "yyyy-MM-dd");

    // Fetch sales for last 30 days
    const { data: sales } = await supabase
      .from("sales")
      .select("*")
      .eq("user_id", userId)
      .gte("sale_date", thirtyDaysAgo)
      .lte("sale_date", today)
      .order("sale_date");

    // Fetch this month's sales
    const { data: thisMonthSales } = await supabase
      .from("sales")
      .select("*")
      .eq("user_id", userId)
      .gte("sale_date", thisMonthStart)
      .lte("sale_date", thisMonthEnd);

    // Fetch last month's sales
    const { data: lastMonthSales } = await supabase
      .from("sales")
      .select("*")
      .eq("user_id", userId)
      .gte("sale_date", lastMonthStart)
      .lte("sale_date", lastMonthEnd);

    // Fetch debtors
    const { data: debtors } = await supabase
      .from("debtors")
      .select("*")
      .eq("user_id", userId);

    // Fetch expenses for this month
    const { data: thisMonthExpenses } = await supabase
      .from("expenses")
      .select("*")
      .eq("user_id", userId)
      .gte("expense_date", thisMonthStart)
      .lte("expense_date", thisMonthEnd);

    // Fetch expenses for last month
    const { data: lastMonthExpenses } = await supabase
      .from("expenses")
      .select("*")
      .eq("user_id", userId)
      .gte("expense_date", lastMonthStart)
      .lte("expense_date", lastMonthEnd);

    // Fetch expenses for last 30 days
    const { data: recentExpenses } = await supabase
      .from("expenses")
      .select("*")
      .eq("user_id", userId)
      .gte("expense_date", thirtyDaysAgo)
      .lte("expense_date", today);

    // Fetch user settings for profit margin goal
    const { data: userSettings } = await supabase
      .from("user_settings")
      .select("profit_margin_goal")
      .eq("user_id", userId)
      .maybeSingle();

    if (userSettings?.profit_margin_goal) {
      setProfitMarginGoal(userSettings.profit_margin_goal);
    }

    // Fetch all sales for customer loyalty tracking
    const { data: allSales } = await supabase
      .from("sales")
      .select("*")
      .eq("user_id", userId);

    // Calculate customer loyalty from debtors (customers with purchase history)
    if (debtors) {
      const loyaltyData = debtors.map((debtor) => ({
        name: debtor.customer_name,
        phone: debtor.customer_phone,
        totalSpent: Number(debtor.grand_total),
        totalPaid: Number(debtor.total_paid),
        balance: Number(debtor.current_balance),
        status: debtor.status,
      })).sort((a, b) => b.totalSpent - a.totalSpent).slice(0, 10);
      
      setCustomerLoyalty(loyaltyData);
    }

    // Calculate monthly comparison
    const thisMonthStats = {
      revenue: thisMonthSales?.reduce((sum, s) => sum + Number(s.revenue), 0) || 0,
      profit: thisMonthSales?.reduce((sum, s) => sum + Number(s.profit_loss), 0) || 0,
      sales: thisMonthSales?.length || 0,
      expenses: thisMonthExpenses?.reduce((sum, e) => sum + Number(e.amount), 0) || 0,
    };

    const lastMonthStats = {
      revenue: lastMonthSales?.reduce((sum, s) => sum + Number(s.revenue), 0) || 0,
      profit: lastMonthSales?.reduce((sum, s) => sum + Number(s.profit_loss), 0) || 0,
      sales: lastMonthSales?.length || 0,
      expenses: lastMonthExpenses?.reduce((sum, e) => sum + Number(e.amount), 0) || 0,
    };

    setMonthlyComparison({ thisMonth: thisMonthStats, lastMonth: lastMonthStats });

    // Set expense summary
    setExpenseSummary({
      total: recentExpenses?.reduce((sum, e) => sum + Number(e.amount), 0) || 0,
      count: recentExpenses?.length || 0,
    });

    if (sales) {
      // Group sales by date
      const salesByDate = sales.reduce((acc: any, sale) => {
        const date = sale.sale_date;
        if (!acc[date]) {
          acc[date] = { date, revenue: 0, profit: 0, sales: 0 };
        }
        acc[date].revenue += Number(sale.revenue);
        acc[date].profit += Number(sale.profit_loss);
        acc[date].sales += 1;
        return acc;
      }, {});

      setSalesData(
        Object.values(salesByDate).map((d: any) => ({
          ...d,
          date: format(new Date(d.date), "MMM dd"),
        }))
      );

      // Group by product
      const productMap = sales.reduce((acc: any, sale) => {
        if (!acc[sale.product_name]) {
          acc[sale.product_name] = { name: sale.product_name, value: 0, quantity: 0 };
        }
        acc[sale.product_name].value += Number(sale.revenue);
        acc[sale.product_name].quantity += sale.quantity;
        return acc;
      }, {});

      setProductStats(
        Object.values(productMap)
          .sort((a: any, b: any) => b.value - a.value)
          .slice(0, 5)
      );
    }

    if (debtors) {
      const debtStats = {
        pending: debtors.filter((d) => d.status === "pending").length,
        paid: debtors.filter((d) => d.status === "paid").length,
        totalOutstanding: debtors.reduce((sum, d) => sum + Number(d.current_balance), 0),
        totalCollected: debtors.reduce((sum, d) => sum + Number(d.total_paid), 0),
      };

      setDebtData([
        { name: "Pending", value: debtStats.pending },
        { name: "Paid", value: debtStats.paid },
      ]);

      setDebtSummary({
        outstanding: debtStats.totalOutstanding,
        collected: debtStats.totalCollected,
      });
    }

    setLoading(false);
  };

  const handlePrint = () => {
    const printContent = printRef.current;
    if (!printContent) return;

    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Analytics Report - ${format(new Date(), "MMMM yyyy")}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; color: #333; }
            h1 { color: #1a1a1a; border-bottom: 2px solid #333; padding-bottom: 10px; }
            h2 { color: #444; margin-top: 30px; }
            .section { margin-bottom: 30px; }
            .grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 20px; margin: 20px 0; }
            .card { border: 1px solid #ddd; padding: 15px; border-radius: 8px; }
            .card h3 { margin: 0 0 10px 0; font-size: 14px; color: #666; }
            .card p { margin: 0; font-size: 24px; font-weight: bold; }
            .positive { color: #16a34a; }
            .negative { color: #dc2626; }
            .neutral { color: #666; }
            table { width: 100%; border-collapse: collapse; margin: 15px 0; }
            th, td { border: 1px solid #ddd; padding: 10px; text-align: left; }
            th { background: #f5f5f5; }
            .comparison { display: flex; gap: 10px; align-items: center; font-size: 12px; }
            .trend-up { color: #16a34a; }
            .trend-down { color: #dc2626; }
            @media print { body { print-color-adjust: exact; -webkit-print-color-adjust: exact; } }
          </style>
        </head>
        <body>
          <h1>📊 Analytics Report</h1>
          <p>Generated on ${format(new Date(), "MMMM dd, yyyy 'at' h:mm a")}</p>
          
          <div class="section">
            <h2>Monthly Comparison (${format(new Date(), "MMMM")} vs ${format(subMonths(new Date(), 1), "MMMM")})</h2>
            <div class="grid">
              <div class="card">
                <h3>This Month Revenue</h3>
                <p>₦${monthlyComparison.thisMonth.revenue.toFixed(2)}</p>
                <div class="comparison ${getChangeClass(monthlyComparison.thisMonth.revenue, monthlyComparison.lastMonth.revenue)}">
                  ${getChangeText(monthlyComparison.thisMonth.revenue, monthlyComparison.lastMonth.revenue)} from last month
                </div>
              </div>
              <div class="card">
                <h3>Last Month Revenue</h3>
                <p class="neutral">₦${monthlyComparison.lastMonth.revenue.toFixed(2)}</p>
              </div>
              <div class="card">
                <h3>This Month Profit</h3>
                <p class="${monthlyComparison.thisMonth.profit >= 0 ? 'positive' : 'negative'}">₦${monthlyComparison.thisMonth.profit.toFixed(2)}</p>
              </div>
              <div class="card">
                <h3>Last Month Profit</h3>
                <p class="${monthlyComparison.lastMonth.profit >= 0 ? 'positive' : 'negative'}">₦${monthlyComparison.lastMonth.profit.toFixed(2)}</p>
              </div>
            </div>
          </div>

          <div class="section">
            <h2>Last 30 Days Summary</h2>
            <div class="grid">
              <div class="card">
                <h3>Total Revenue</h3>
                <p>₦${totalRevenue.toFixed(2)}</p>
              </div>
              <div class="card">
                <h3>Total Profit</h3>
                <p class="${totalProfit >= 0 ? 'positive' : 'negative'}">₦${totalProfit.toFixed(2)}</p>
              </div>
              <div class="card">
                <h3>Total Sales</h3>
                <p>${totalSales}</p>
              </div>
              <div class="card">
                <h3>Average per Sale</h3>
                <p>₦${totalSales > 0 ? (totalRevenue / totalSales).toFixed(2) : "0.00"}</p>
              </div>
            </div>
          </div>

          <div class="section">
            <h2>Top Products</h2>
            <table>
              <thead>
                <tr><th>Product</th><th>Revenue</th><th>Quantity Sold</th></tr>
              </thead>
              <tbody>
                ${productStats.map((p: any) => `<tr><td>${p.name}</td><td>₦${p.value.toFixed(2)}</td><td>${p.quantity}</td></tr>`).join("")}
              </tbody>
            </table>
          </div>

          <div class="section">
            <h2>Debt Summary</h2>
            <div class="grid">
              <div class="card">
                <h3>Outstanding Balance</h3>
                <p class="negative">₦${debtSummary.outstanding.toFixed(2)}</p>
              </div>
              <div class="card">
                <h3>Total Collected</h3>
                <p class="positive">₦${debtSummary.collected.toFixed(2)}</p>
              </div>
              <div class="card">
                <h3>Pending Debtors</h3>
                <p>${debtData.find((d) => d.name === "Pending")?.value || 0}</p>
              </div>
              <div class="card">
                <h3>Fully Paid</h3>
                <p>${debtData.find((d) => d.name === "Paid")?.value || 0}</p>
              </div>
            </div>
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.print();
  };

  const getChangePercent = (current: number, previous: number) => {
    if (previous === 0) return current > 0 ? 100 : 0;
    return ((current - previous) / previous) * 100;
  };

  const getChangeClass = (current: number, previous: number) => {
    const change = current - previous;
    if (change > 0) return "trend-up";
    if (change < 0) return "trend-down";
    return "";
  };

  const getChangeText = (current: number, previous: number) => {
    const percent = getChangePercent(current, previous);
    if (percent > 0) return `↑ ${percent.toFixed(1)}%`;
    if (percent < 0) return `↓ ${Math.abs(percent).toFixed(1)}%`;
    return "No change";
  };

  const ComparisonIndicator = ({ current, previous }: { current: number; previous: number }) => {
    const percent = getChangePercent(current, previous);
    if (percent > 0) {
      return (
        <span className="flex items-center gap-1 text-xs text-success">
          <TrendingUp className="w-3 h-3" /> +{percent.toFixed(1)}%
        </span>
      );
    }
    if (percent < 0) {
      return (
        <span className="flex items-center gap-1 text-xs text-destructive">
          <TrendingDown className="w-3 h-3" /> {percent.toFixed(1)}%
        </span>
      );
    }
    return (
      <span className="flex items-center gap-1 text-xs text-muted-foreground">
        <Minus className="w-3 h-3" /> No change
      </span>
    );
  };

  const totalRevenue = salesData.reduce((sum, d) => sum + d.revenue, 0);
  const totalProfit = salesData.reduce((sum, d) => sum + d.profit, 0);
  const totalSales = salesData.reduce((sum, d) => sum + d.sales, 0);
  const currentProfitMargin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;
  const isMarginBelowGoal = currentProfitMargin < profitMarginGoal && totalRevenue > 0;

  if (loading) {
    return (
      <Card className="p-5">
        <p className="text-center text-muted-foreground">Loading analytics...</p>
      </Card>
    );
  }

  return (
    <div className="space-y-5" ref={printRef}>
      <Card className="p-5">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-xl font-semibold mb-1">📊 Analytics Dashboard</h2>
            <p className="text-muted-foreground text-sm">Performance overview & monthly comparison</p>
          </div>
          <Button onClick={handlePrint} variant="outline" className="flex items-center gap-2">
            <Printer className="w-4 h-4" /> Print Report
          </Button>
        </div>
      </Card>

      {/* Profit Margin Alert */}
      {isMarginBelowGoal && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Profit Margin Alert</AlertTitle>
          <AlertDescription>
            Your current profit margin ({currentProfitMargin.toFixed(1)}%) is below your target of {profitMarginGoal}%. 
            Consider reviewing your pricing strategy or reducing costs.
          </AlertDescription>
        </Alert>
      )}

      {/* Monthly Comparison */}
      <Card className="p-5">
        <h3 className="text-lg font-semibold mb-4">
          📅 Monthly Comparison: {format(new Date(), "MMMM")} vs {format(subMonths(new Date(), 1), "MMMM")}
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="p-4 bg-muted/30 rounded-lg">
            <p className="text-sm text-muted-foreground mb-1">Revenue</p>
            <div className="flex items-end gap-3">
              <div>
                <p className="text-xs text-muted-foreground">This Month</p>
                <p className="text-xl font-bold text-primary">₦{monthlyComparison.thisMonth.revenue.toFixed(2)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Last Month</p>
                <p className="text-lg text-muted-foreground">₦{monthlyComparison.lastMonth.revenue.toFixed(2)}</p>
              </div>
            </div>
            <ComparisonIndicator current={monthlyComparison.thisMonth.revenue} previous={monthlyComparison.lastMonth.revenue} />
          </div>
          <div className="p-4 bg-muted/30 rounded-lg">
            <p className="text-sm text-muted-foreground mb-1">Profit</p>
            <div className="flex items-end gap-3">
              <div>
                <p className="text-xs text-muted-foreground">This Month</p>
                <p className={`text-xl font-bold ${monthlyComparison.thisMonth.profit >= 0 ? "text-success" : "text-destructive"}`}>
                  ₦{monthlyComparison.thisMonth.profit.toFixed(2)}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Last Month</p>
                <p className="text-lg text-muted-foreground">₦{monthlyComparison.lastMonth.profit.toFixed(2)}</p>
              </div>
            </div>
            <ComparisonIndicator current={monthlyComparison.thisMonth.profit} previous={monthlyComparison.lastMonth.profit} />
          </div>
          <div className="p-4 bg-muted/30 rounded-lg">
            <p className="text-sm text-muted-foreground mb-1">Expenses</p>
            <div className="flex items-end gap-3">
              <div>
                <p className="text-xs text-muted-foreground">This Month</p>
                <p className="text-xl font-bold text-destructive">₦{monthlyComparison.thisMonth.expenses.toFixed(2)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Last Month</p>
                <p className="text-lg text-muted-foreground">₦{monthlyComparison.lastMonth.expenses.toFixed(2)}</p>
              </div>
            </div>
            <ComparisonIndicator current={monthlyComparison.lastMonth.expenses} previous={monthlyComparison.thisMonth.expenses} />
          </div>
          <div className="p-4 bg-muted/30 rounded-lg">
            <p className="text-sm text-muted-foreground mb-1">Net Profit</p>
            <div className="flex items-end gap-3">
              <div>
                <p className="text-xs text-muted-foreground">This Month</p>
                <p className={`text-xl font-bold ${(monthlyComparison.thisMonth.profit - monthlyComparison.thisMonth.expenses) >= 0 ? "text-success" : "text-destructive"}`}>
                  ₦{(monthlyComparison.thisMonth.profit - monthlyComparison.thisMonth.expenses).toFixed(2)}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Last Month</p>
                <p className="text-lg text-muted-foreground">
                  ₦{(monthlyComparison.lastMonth.profit - monthlyComparison.lastMonth.expenses).toFixed(2)}
                </p>
              </div>
            </div>
            <ComparisonIndicator 
              current={monthlyComparison.thisMonth.profit - monthlyComparison.thisMonth.expenses} 
              previous={monthlyComparison.lastMonth.profit - monthlyComparison.lastMonth.expenses} 
            />
          </div>
        </div>
      </Card>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card className="p-5 text-center">
          <h3 className="text-muted-foreground text-sm mb-2">Revenue (30d)</h3>
          <p className="text-2xl font-bold text-primary">₦{totalRevenue.toFixed(2)}</p>
        </Card>
        <Card className="p-5 text-center">
          <h3 className="text-muted-foreground text-sm mb-2">Gross Profit (30d)</h3>
          <p className={`text-2xl font-bold ${totalProfit >= 0 ? "text-success" : "text-destructive"}`}>
            ₦{totalProfit.toFixed(2)}
          </p>
        </Card>
        <Card className="p-5 text-center">
          <h3 className="text-muted-foreground text-sm mb-2">Expenses (30d)</h3>
          <p className="text-2xl font-bold text-destructive">₦{expenseSummary.total.toFixed(2)}</p>
        </Card>
        <Card className="p-5 text-center">
          <h3 className="text-muted-foreground text-sm mb-2">Net Profit (30d)</h3>
          <p className={`text-2xl font-bold ${(totalProfit - expenseSummary.total) >= 0 ? "text-success" : "text-destructive"}`}>
            ₦{(totalProfit - expenseSummary.total).toFixed(2)}
          </p>
        </Card>
        <Card className="p-5 text-center">
          <h3 className="text-muted-foreground text-sm mb-2">Sales Count (30d)</h3>
          <p className="text-2xl font-bold text-info">{totalSales}</p>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Revenue Trend */}
        <Card className="p-5">
          <h3 className="text-lg font-semibold mb-4">Revenue Trend</h3>
          {salesData.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={salesData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--background))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="revenue"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  dot={{ fill: "hsl(var(--primary))" }}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-center text-muted-foreground py-8">No sales data available</p>
          )}
        </Card>

        {/* Profit Trend */}
        <Card className="p-5">
          <h3 className="text-lg font-semibold mb-4">Profit Trend</h3>
          {salesData.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={salesData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--background))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                  }}
                />
                <Bar dataKey="profit" fill="hsl(var(--success))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-center text-muted-foreground py-8">No profit data available</p>
          )}
        </Card>
      </div>

      {/* Second Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Top Products */}
        <Card className="p-5">
          <h3 className="text-lg font-semibold mb-4">Top Products by Revenue</h3>
          {productStats.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={productStats} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <YAxis
                  dataKey="name"
                  type="category"
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={12}
                  width={100}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--background))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                  }}
                  formatter={(value: number) => [`₦${value.toFixed(2)}`, "Revenue"]}
                />
                <Bar dataKey="value" fill="hsl(var(--info))" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-center text-muted-foreground py-8">No product data available</p>
          )}
        </Card>

        {/* Debt Status */}
        <Card className="p-5">
          <h3 className="text-lg font-semibold mb-4">Debt Status Distribution</h3>
          {debtData.length > 0 && debtData.some((d) => d.value > 0) ? (
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={debtData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={5}
                  dataKey="value"
                  label={({ name, value }) => `${name}: ${value}`}
                >
                  {debtData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--background))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-center text-muted-foreground py-8">No debt data available</p>
          )}
        </Card>
      </div>

      {/* Debt Summary */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="p-5 text-center">
          <h3 className="text-muted-foreground text-sm mb-2">Outstanding Debt</h3>
          <p className="text-2xl font-bold text-destructive">₦{debtSummary.outstanding.toFixed(2)}</p>
        </Card>
        <Card className="p-5 text-center">
          <h3 className="text-muted-foreground text-sm mb-2">Total Collected</h3>
          <p className="text-2xl font-bold text-success">₦{debtSummary.collected.toFixed(2)}</p>
        </Card>
      </div>

      {/* Customer Loyalty Tracking */}
      <Card className="p-5">
        <div className="flex items-center gap-2 mb-4">
          <Users className="w-5 h-5 text-primary" />
          <h3 className="text-lg font-semibold">Customer Loyalty - Top Customers</h3>
        </div>
        {customerLoyalty.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-muted">
                <tr>
                  <th className="p-3 text-left">Customer</th>
                  <th className="p-3 text-left">Phone</th>
                  <th className="p-3 text-left">Lifetime Value</th>
                  <th className="p-3 text-left">Total Paid</th>
                  <th className="p-3 text-left">Balance</th>
                  <th className="p-3 text-left">Status</th>
                </tr>
              </thead>
              <tbody>
                {customerLoyalty.map((customer, index) => (
                  <tr key={index} className="border-b hover:bg-muted/50">
                    <td className="p-3 font-medium">{customer.name}</td>
                    <td className="p-3">{customer.phone}</td>
                    <td className="p-3 text-primary font-semibold">₦{customer.totalSpent.toFixed(2)}</td>
                    <td className="p-3 text-success">₦{customer.totalPaid.toFixed(2)}</td>
                    <td className={`p-3 ${customer.balance > 0 ? "text-destructive" : "text-success"}`}>
                      ₦{customer.balance.toFixed(2)}
                    </td>
                    <td className="p-3">
                      <span className={`px-2 py-1 rounded-full text-xs ${
                        customer.status === "paid" ? "bg-success/20 text-success" : "bg-warning/20 text-warning"
                      }`}>
                        {customer.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-center text-muted-foreground py-8">No customer data available</p>
        )}
      </Card>
    </div>
  );
};

export default AnalyticsDashboard;
