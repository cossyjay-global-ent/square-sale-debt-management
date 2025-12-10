import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Card } from "./ui/card";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { z } from "zod";
import { Download } from "lucide-react";
import StockManagement from "./StockManagement";
import { exportToCsv } from "@/lib/exportCsv";

interface SalesPageProps {
  userId: string;
}

const saleSchema = z.object({
  sale_date: z.string().min(1, "Date is required"),
  sale_time: z.string().min(1, "Time is required"),
  product_name: z.string().min(1, "Product name is required").max(100, "Product name too long"),
  quantity: z.string().refine((val) => parseInt(val) >= 1, "Quantity must be at least 1"),
  cost_price: z.string().refine((val) => parseFloat(val) >= 0.01, "Cost price must be at least 0.01"),
  selling_price: z.string().refine((val) => parseFloat(val) >= 0.01, "Selling price must be at least 0.01"),
});

interface StockItem {
  id: string;
  product_name: string;
  cost_price: number;
  quantity: number;
}

const SalesPage = ({ userId }: SalesPageProps) => {
  const [sales, setSales] = useState<any[]>([]);
  const [stockItems, setStockItems] = useState<StockItem[]>([]);
  const [startDate, setStartDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [endDate, setEndDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formData, setFormData] = useState({
    sale_date: format(new Date(), "yyyy-MM-dd"),
    sale_time: format(new Date(), "HH:mm"),
    product_name: "",
    quantity: "",
    cost_price: "",
    selling_price: "",
  });
  const { toast } = useToast();

  const fetchStock = async () => {
    const { data } = await supabase
      .from("stock")
      .select("id, product_name, cost_price, quantity")
      .eq("user_id", userId)
      .gt("quantity", 0)
      .order("product_name");
    setStockItems(data || []);
  };


  const exportSales = () => {
    if (sales.length === 0) {
      toast({ title: "No sales to export", variant: "destructive" });
      return;
    }
    const exportData = sales.map((sale) => ({
      Date: sale.sale_date,
      Time: sale.sale_time,
      Product: sale.product_name,
      Quantity: sale.quantity,
      "Cost Price": sale.cost_price,
      "Selling Price": sale.selling_price,
      "Total Cost": sale.total_cost,
      Revenue: sale.revenue,
      "Profit/Loss": sale.profit_loss,
    }));
    exportToCsv(`sales_${startDate}_to_${endDate}`, exportData);
    toast({ title: "Sales exported successfully!" });
  };

  const fetchSales = async () => {
    if (!startDate || !endDate) {
      toast({ title: "Please select valid date range", variant: "destructive" });
      return;
    }
    
    setLoading(true);
    const { data, error } = await supabase
      .from("sales")
      .select("*")
      .eq("user_id", userId)
      .gte("sale_date", startDate)
      .lte("sale_date", endDate)
      .order("sale_date", { ascending: false });

    setLoading(false);
    if (error) {
      toast({ title: "Error fetching sales", description: error.message, variant: "destructive" });
    } else {
      setSales(data || []);
    }
  };

  useEffect(() => {
    fetchSales();
    fetchStock();
  }, [userId, startDate, endDate]);

  const handleChange = (field: string, value: string) => {
    setFormData({ ...formData, [field]: value });
    setErrors({ ...errors, [field]: "" });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    const validation = saleSchema.safeParse(formData);
    if (!validation.success) {
      const newErrors: Record<string, string> = {};
      validation.error.errors.forEach((err) => {
        if (err.path[0]) newErrors[err.path[0].toString()] = err.message;
      });
      setErrors(newErrors);
      return;
    }

    setLoading(true);
    const quantity = parseInt(formData.quantity);
    const costPrice = parseFloat(formData.cost_price);
    const sellingPrice = parseFloat(formData.selling_price);
    const totalCost = quantity * costPrice;
    const revenue = quantity * sellingPrice;
    const profitLoss = revenue - totalCost;

    // Check stock availability and deduct
    const { data: stockItem } = await supabase
      .from("stock")
      .select("*")
      .eq("user_id", userId)
      .ilike("product_name", formData.product_name.trim())
      .maybeSingle();

    if (stockItem) {
      if (stockItem.quantity < quantity) {
        setLoading(false);
        toast({ 
          title: "Insufficient stock", 
          description: `Only ${stockItem.quantity} units available in stock`, 
          variant: "destructive" 
        });
        return;
      }

      // Deduct from stock
      const { error: stockError } = await supabase
        .from("stock")
        .update({
          quantity: stockItem.quantity - quantity,
          total_sold: stockItem.total_sold + quantity,
        })
        .eq("id", stockItem.id);

      if (stockError) {
        setLoading(false);
        toast({ title: "Error updating stock", description: stockError.message, variant: "destructive" });
        return;
      }
    }

    const { error } = await supabase.from("sales").insert({
      user_id: userId,
      sale_date: formData.sale_date,
      sale_time: formData.sale_time,
      product_name: formData.product_name.trim(),
      quantity,
      cost_price: costPrice,
      selling_price: sellingPrice,
      total_cost: totalCost,
      revenue,
      profit_loss: profitLoss,
    });

    setLoading(false);
    if (error) {
      toast({ title: "Error adding sale", description: error.message, variant: "destructive" });
    } else {
      const stockMessage = stockItem ? " Stock updated." : "";
      toast({ title: `Sale recorded successfully!${stockMessage}` });
      setFormData({
        sale_date: format(new Date(), "yyyy-MM-dd"),
        sale_time: format(new Date(), "HH:mm"),
        product_name: "",
        quantity: "",
        cost_price: "",
        selling_price: "",
      });
      fetchSales();
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this sale?")) return;
    
    setLoading(true);
    const { error } = await supabase.from("sales").delete().eq("id", id);
    setLoading(false);
    
    if (error) {
      toast({ title: "Error deleting sale", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Sale deleted successfully" });
      fetchSales();
    }
  };

  const calculateSummary = () => {
    const totalQuantity = sales.reduce((sum, sale) => sum + sale.quantity, 0);
    const totalCost = sales.reduce((sum, sale) => sum + parseFloat(sale.total_cost), 0);
    const totalRevenue = sales.reduce((sum, sale) => sum + parseFloat(sale.revenue), 0);
    const totalProfit = sales.filter((s) => s.profit_loss > 0).reduce((sum, s) => sum + s.profit_loss, 0);
    const totalLoss = sales.filter((s) => s.profit_loss < 0).reduce((sum, s) => sum + Math.abs(s.profit_loss), 0);
    const netResult = totalRevenue - totalCost;

    return {
      totalProducts: new Set(sales.map((s) => s.product_name)).size,
      totalQuantity,
      totalCost,
      totalRevenue,
      totalProfit,
      totalLoss,
      netResult,
    };
  };

  const summary = calculateSummary();

  return (
    <div className="space-y-5">
      <Card className="p-5">
        <h1 className="text-3xl font-bold text-primary">📊 Square Sales Platform</h1>
        <p className="text-muted-foreground mt-2">{format(new Date(), "MMMM dd, yyyy")}</p>
      </Card>

      <Card className="p-5">
        <h2 className="text-xl font-semibold mb-4">📅 Select Date Range</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <Label>From</Label>
            <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="mt-2" />
          </div>
          <div>
            <Label>To</Label>
            <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="mt-2" />
          </div>
          <div className="flex items-end gap-2">
            <Button onClick={fetchSales} className="flex-1" disabled={loading}>
              {loading ? "Loading..." : "Apply"}
            </Button>
            <Button variant="secondary" onClick={() => {
              const today = format(new Date(), "yyyy-MM-dd");
              setStartDate(today);
              setEndDate(today);
            }}>
              Today
            </Button>
          </div>
        </div>
      </Card>

      <StockManagement userId={userId} />

      <Card className="p-5">
        <h2 className="text-xl font-semibold mb-4">➕ Add New Sale</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Date</Label>
              <Input
                type="date"
                value={formData.sale_date}
                onChange={(e) => handleChange("sale_date", e.target.value)}
                className="mt-2"
              />
              {errors.sale_date && <p className="text-destructive text-sm mt-1">{errors.sale_date}</p>}
            </div>
            <div>
              <Label>Time</Label>
              <Input
                type="time"
                value={formData.sale_time}
                onChange={(e) => handleChange("sale_time", e.target.value)}
                className="mt-2"
              />
              {errors.sale_time && <p className="text-destructive text-sm mt-1">{errors.sale_time}</p>}
            </div>
            <div>
              <Label>Product Name</Label>
              <Input
                type="text"
                value={formData.product_name}
                onChange={(e) => handleChange("product_name", e.target.value)}
                placeholder="Enter product name"
                className="mt-2"
              />
              {errors.product_name && <p className="text-destructive text-sm mt-1">{errors.product_name}</p>}
            </div>
            <div>
              <Label>Quantity</Label>
              <Input
                type="number"
                min="1"
                value={formData.quantity}
                onChange={(e) => handleChange("quantity", e.target.value)}
                placeholder="Enter quantity"
                className="mt-2"
              />
              {errors.quantity && <p className="text-destructive text-sm mt-1">{errors.quantity}</p>}
            </div>
            <div>
              <Label>Cost Price (₦)</Label>
              <Input
                type="number"
                step="0.01"
                min="0.01"
                value={formData.cost_price}
                onChange={(e) => handleChange("cost_price", e.target.value)}
                placeholder="0.00"
                className="mt-2"
              />
              {errors.cost_price && <p className="text-destructive text-sm mt-1">{errors.cost_price}</p>}
            </div>
            <div>
              <Label>Selling Price (₦)</Label>
              <Input
                type="number"
                step="0.01"
                min="0.01"
                value={formData.selling_price}
                onChange={(e) => handleChange("selling_price", e.target.value)}
                placeholder="0.00"
                className="mt-2"
              />
              {errors.selling_price && <p className="text-destructive text-sm mt-1">{errors.selling_price}</p>}
            </div>
          </div>
          <Button type="submit" className="w-full md:w-auto" disabled={loading}>
            {loading ? "Recording..." : "Record Sale"}
          </Button>
        </form>
      </Card>

      <Card className="p-5">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">📈 Sales Summary</h2>
          <Button variant="secondary" size="sm" onClick={exportSales}>
            <Download size={16} className="mr-2" /> Export CSV
          </Button>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
          <div className="bg-muted p-4 rounded-lg text-center">
            <p className="text-sm text-muted-foreground">Products</p>
            <p className="text-2xl font-bold">{summary.totalProducts}</p>
          </div>
          <div className="bg-muted p-4 rounded-lg text-center">
            <p className="text-sm text-muted-foreground">Quantity</p>
            <p className="text-2xl font-bold">{summary.totalQuantity}</p>
          </div>
          <div className="bg-muted p-4 rounded-lg text-center">
            <p className="text-sm text-muted-foreground">Total Cost</p>
            <p className="text-2xl font-bold">₦{summary.totalCost.toFixed(2)}</p>
          </div>
          <div className="bg-muted p-4 rounded-lg text-center">
            <p className="text-sm text-muted-foreground">Total Revenue</p>
            <p className="text-2xl font-bold">₦{summary.totalRevenue.toFixed(2)}</p>
          </div>
          <div className="bg-muted p-4 rounded-lg text-center">
            <p className="text-sm text-muted-foreground">Profit</p>
            <p className="text-2xl font-bold text-success">₦{summary.totalProfit.toFixed(2)}</p>
          </div>
          <div className="bg-muted p-4 rounded-lg text-center">
            <p className="text-sm text-muted-foreground">Loss</p>
            <p className="text-2xl font-bold text-destructive">₦{summary.totalLoss.toFixed(2)}</p>
          </div>
          <div className="bg-gradient-primary p-4 rounded-lg text-center text-primary-foreground">
            <p className="text-sm">Net Result</p>
            <p className="text-2xl font-bold">₦{summary.netResult.toFixed(2)}</p>
          </div>
        </div>
      </Card>

      <Card className="p-5">
        <h2 className="text-xl font-semibold mb-4">📋 Sales Records</h2>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-muted">
              <tr>
                <th className="p-3 text-left">Date</th>
                <th className="p-3 text-left">Time</th>
                <th className="p-3 text-left">Product</th>
                <th className="p-3 text-left">Qty</th>
                <th className="p-3 text-left">Cost</th>
                <th className="p-3 text-left">Price</th>
                <th className="p-3 text-left">Revenue</th>
                <th className="p-3 text-left">P/L</th>
                <th className="p-3 text-left">Actions</th>
              </tr>
            </thead>
            <tbody>
              {sales.length === 0 ? (
                <tr>
                  <td colSpan={9} className="p-6 text-center text-muted-foreground">
                    No sales recorded for this period
                  </td>
                </tr>
              ) : (
                sales.map((sale) => (
                  <tr key={sale.id} className="border-b hover:bg-muted/50">
                    <td className="p-3">{format(new Date(sale.sale_date), "MMM dd, yyyy")}</td>
                    <td className="p-3">{sale.sale_time}</td>
                    <td className="p-3">{sale.product_name}</td>
                    <td className="p-3">{sale.quantity}</td>
                    <td className="p-3">₦{parseFloat(sale.cost_price).toFixed(2)}</td>
                    <td className="p-3">₦{parseFloat(sale.selling_price).toFixed(2)}</td>
                    <td className="p-3">₦{parseFloat(sale.revenue).toFixed(2)}</td>
                    <td className={`p-3 font-semibold ${sale.profit_loss >= 0 ? "text-success" : "text-destructive"}`}>
                      ₦{parseFloat(sale.profit_loss).toFixed(2)}
                    </td>
                    <td className="p-3">
                      <Button variant="destructive" size="sm" onClick={() => handleDelete(sale.id)} disabled={loading}>
                        Delete
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
};

export default SalesPage;