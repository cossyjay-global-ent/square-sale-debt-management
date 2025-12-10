import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Card } from "./ui/card";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { AlertTriangle, Settings, Plus, X } from "lucide-react";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";

interface StockManagementProps {
  userId: string;
}

const stockSchema = z.object({
  product_name: z.string().min(1, "Product name is required").max(100, "Product name too long"),
  quantity: z.string().refine((val) => parseInt(val) >= 1, "Quantity must be at least 1"),
  cost_price: z.string().refine((val) => parseFloat(val) >= 0.01, "Cost price must be at least 0.01"),
});

const StockManagement = ({ userId }: StockManagementProps) => {
  const [stock, setStock] = useState<any[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [showTable, setShowTable] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [lowStockThreshold, setLowStockThreshold] = useState(10);
  const [restockItem, setRestockItem] = useState<any>(null);
  const [restockQuantity, setRestockQuantity] = useState("");
  const [formData, setFormData] = useState({
    product_name: "",
    quantity: "",
    cost_price: "",
  });
  const { toast } = useToast();

  const fetchStock = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("stock")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    setLoading(false);
    if (error) {
      toast({ title: "Error fetching stock", description: error.message, variant: "destructive" });
    } else {
      setStock(data || []);
    }
  };

  useEffect(() => {
    // Always fetch stock to check for low stock alerts
    fetchStock();
  }, [userId]);

  useEffect(() => {
    if (showTable) {
      fetchStock();
    }
  }, [showTable]);

  const handleChange = (field: string, value: string) => {
    setFormData({ ...formData, [field]: value });
    setErrors({ ...errors, [field]: "" });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    const validation = stockSchema.safeParse(formData);
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

    const { error } = await supabase.from("stock").insert({
      user_id: userId,
      product_name: formData.product_name.trim(),
      quantity,
      cost_price: costPrice,
    });

    setLoading(false);
    if (error) {
      toast({ title: "Error adding stock", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Stock added successfully!" });
      setFormData({ product_name: "", quantity: "", cost_price: "" });
      setShowForm(false);
      fetchStock();
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this stock item?")) return;
    
    setLoading(true);
    const { error } = await supabase.from("stock").delete().eq("id", id);
    setLoading(false);
    
    if (error) {
      toast({ title: "Error deleting stock", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Stock deleted successfully" });
      fetchStock();
    }
  };

  const handleRestock = async () => {
    if (!restockItem || !restockQuantity) return;
    
    const addQuantity = parseInt(restockQuantity);
    if (isNaN(addQuantity) || addQuantity < 1) {
      toast({ title: "Please enter a valid quantity", variant: "destructive" });
      return;
    }

    setLoading(true);
    const newQuantity = restockItem.quantity + addQuantity;
    
    const { error } = await supabase
      .from("stock")
      .update({ quantity: newQuantity, updated_at: new Date().toISOString() })
      .eq("id", restockItem.id);

    setLoading(false);
    if (error) {
      toast({ title: "Error restocking", description: error.message, variant: "destructive" });
    } else {
      toast({ title: `Added ${addQuantity} units to ${restockItem.product_name}` });
      setRestockItem(null);
      setRestockQuantity("");
      fetchStock();
    }
  };

  const lowStockItems = stock.filter((item) => item.quantity <= lowStockThreshold && item.quantity > 0);
  const outOfStockItems = stock.filter((item) => item.quantity === 0);
  const totalStockValue = stock.reduce((sum, item) => sum + item.quantity * parseFloat(item.cost_price), 0);

  return (
    <div className="space-y-5">
      {/* Low Stock Alerts */}
      {(lowStockItems.length > 0 || outOfStockItems.length > 0) && (
        <Card className="p-5 border-warning bg-warning/10">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="w-5 h-5 text-warning" />
            <h3 className="font-semibold text-warning">Stock Alerts</h3>
          </div>
          
          {outOfStockItems.length > 0 && (
            <div className="mb-3">
              <p className="text-sm font-medium text-destructive mb-2">Out of Stock ({outOfStockItems.length}):</p>
              <div className="flex flex-wrap gap-2">
                {outOfStockItems.map((item) => (
                  <span
                    key={item.id}
                    className="px-2 py-1 bg-destructive/20 text-destructive text-sm rounded-md"
                  >
                    {item.product_name}
                  </span>
                ))}
              </div>
            </div>
          )}
          
          {lowStockItems.length > 0 && (
            <div>
              <p className="text-sm font-medium text-warning mb-2">Low Stock ({lowStockItems.length}):</p>
              <div className="flex flex-wrap gap-2">
                {lowStockItems.map((item) => (
                  <span
                    key={item.id}
                    className="px-2 py-1 bg-warning/20 text-warning text-sm rounded-md"
                  >
                    {item.product_name} ({item.quantity} left)
                  </span>
                ))}
              </div>
            </div>
          )}
        </Card>
      )}

      <Card className="p-5">
        <div className="flex justify-between items-center mb-4 flex-wrap gap-3">
          <h2 className="text-xl font-semibold">📦 Stock Management</h2>
          <div className="flex gap-2 flex-wrap">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowSettings(!showSettings)}
              title="Settings"
            >
              <Settings className="w-4 h-4" />
            </Button>
            <Button 
              variant="secondary" 
              onClick={() => { 
                setShowTable(!showTable); 
                if (!showTable) fetchStock(); 
              }}
              disabled={loading}
            >
              {showTable ? "Hide Stock" : "Show Stock"}
            </Button>
            <Button onClick={() => setShowForm(!showForm)}>
              {showForm ? "Cancel" : "Add Stock"}
            </Button>
          </div>
        </div>

        {showSettings && (
          <div className="mb-4 p-4 bg-muted/50 rounded-lg">
            <h3 className="font-medium mb-2">Alert Settings</h3>
            <div className="flex items-center gap-3">
              <Label className="whitespace-nowrap">Low stock threshold:</Label>
              <Input
                type="number"
                min="1"
                max="100"
                value={lowStockThreshold}
                onChange={(e) => setLowStockThreshold(Math.max(1, parseInt(e.target.value) || 10))}
                className="w-24"
              />
              <span className="text-sm text-muted-foreground">units</span>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Products with quantity at or below this threshold will trigger a low stock alert.
            </p>
          </div>
        )}

        {showForm && (
          <form onSubmit={handleSubmit} className="space-y-4 mb-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label>Product Name *</Label>
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
                <Label>Quantity *</Label>
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
                <Label>Cost Price (₦) *</Label>
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
            </div>
            <Button type="submit" disabled={loading}>
              {loading ? "Adding..." : "Add to Stock"}
            </Button>
          </form>
        )}

        {showTable && (
          <div className="overflow-x-auto">
            {loading ? (
              <p className="text-center py-4 text-muted-foreground">Loading stock...</p>
            ) : stock.length === 0 ? (
              <p className="text-center py-4 text-muted-foreground">No stock items found</p>
            ) : (
              <table className="w-full">
                <thead className="bg-muted">
                  <tr>
                    <th className="p-3 text-left">Product</th>
                    <th className="p-3 text-left">Current Qty</th>
                    <th className="p-3 text-left">Cost Price</th>
                    <th className="p-3 text-left">Total Amount</th>
                    <th className="p-3 text-left">Total Sold</th>
                    <th className="p-3 text-left">Date Added</th>
                    <th className="p-3 text-left">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {stock.map((item) => (
                    <tr
                      key={item.id}
                      className={`border-b hover:bg-muted/50 ${
                        item.quantity === 0
                          ? "bg-destructive/10"
                          : item.quantity <= lowStockThreshold
                          ? "bg-warning/10"
                          : ""
                      }`}
                    >
                      <td className="p-3 font-medium">
                        {item.product_name}
                        {item.quantity === 0 && (
                          <span className="ml-2 text-xs px-1.5 py-0.5 bg-destructive text-destructive-foreground rounded">
                            OUT
                          </span>
                        )}
                        {item.quantity > 0 && item.quantity <= lowStockThreshold && (
                          <span className="ml-2 text-xs px-1.5 py-0.5 bg-warning text-warning-foreground rounded">
                            LOW
                          </span>
                        )}
                      </td>
                      <td className="p-3">{item.quantity}</td>
                      <td className="p-3">₦{parseFloat(item.cost_price).toFixed(2)}</td>
                      <td className="p-3 font-semibold">₦{(item.quantity * parseFloat(item.cost_price)).toFixed(2)}</td>
                      <td className="p-3">{item.total_sold}</td>
                      <td className="p-3">{format(new Date(item.created_at), "MMM dd, yyyy")}</td>
                      <td className="p-3">
                        <div className="flex gap-2">
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => {
                              setRestockItem(item);
                              setRestockQuantity("");
                            }}
                            disabled={loading}
                          >
                            <Plus className="w-3 h-3 mr-1" /> Restock
                          </Button>
                          <Button variant="destructive" size="sm" onClick={() => handleDelete(item.id)} disabled={loading}>
                            Delete
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  <tr className="bg-primary/10 font-bold">
                    <td colSpan={3} className="p-3 text-right">Grand Total:</td>
                    <td className="p-3 text-lg">₦{totalStockValue.toFixed(2)}</td>
                    <td colSpan={3}></td>
                  </tr>
                </tbody>
              </table>
            )}
          </div>
        )}
      </Card>

      {/* Restock Modal */}
      <Dialog open={!!restockItem} onOpenChange={(open) => !open && setRestockItem(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Restock {restockItem?.product_name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div>
              <p className="text-sm text-muted-foreground mb-2">
                Current quantity: <span className="font-semibold">{restockItem?.quantity}</span>
              </p>
              <Label>Quantity to Add</Label>
              <Input
                type="number"
                min="1"
                value={restockQuantity}
                onChange={(e) => setRestockQuantity(e.target.value)}
                placeholder="Enter quantity to add"
                className="mt-2"
              />
            </div>
            {restockQuantity && parseInt(restockQuantity) > 0 && (
              <p className="text-sm text-muted-foreground">
                New total: <span className="font-semibold text-primary">
                  {restockItem?.quantity + parseInt(restockQuantity)}
                </span>
              </p>
            )}
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setRestockItem(null)}>
                Cancel
              </Button>
              <Button onClick={handleRestock} disabled={loading || !restockQuantity}>
                {loading ? "Adding..." : "Add Stock"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default StockManagement;
