import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Card } from "./ui/card";
import { useToast } from "@/hooks/use-toast";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { Trash2, Plus, Download, TrendingDown } from "lucide-react";
import { z } from "zod";
import { exportToCsv } from "@/lib/exportCsv";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";

interface ExpenseTrackingProps {
  userId: string;
}

const expenseSchema = z.object({
  expense_date: z.string().min(1, "Date is required"),
  category: z.string().min(1, "Category is required"),
  description: z.string().min(1, "Description is required").max(200, "Description too long"),
  amount: z.string().refine((val) => parseFloat(val) >= 0.01, "Amount must be at least 0.01"),
});

const EXPENSE_CATEGORIES = [
  "Rent",
  "Utilities",
  "Salaries",
  "Inventory",
  "Transportation",
  "Marketing",
  "Equipment",
  "Supplies",
  "Maintenance",
  "Insurance",
  "Taxes",
  "Other",
];

const ExpenseTracking = ({ userId }: ExpenseTrackingProps) => {
  const [expenses, setExpenses] = useState<any[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [filterMonth, setFilterMonth] = useState(format(new Date(), "yyyy-MM"));
  const [formData, setFormData] = useState({
    expense_date: format(new Date(), "yyyy-MM-dd"),
    category: "",
    description: "",
    amount: "",
  });
  const { toast } = useToast();

  const fetchExpenses = async () => {
    setLoading(true);
    const startDate = format(startOfMonth(new Date(filterMonth)), "yyyy-MM-dd");
    const endDate = format(endOfMonth(new Date(filterMonth)), "yyyy-MM-dd");

    const { data, error } = await supabase
      .from("expenses")
      .select("*")
      .eq("user_id", userId)
      .gte("expense_date", startDate)
      .lte("expense_date", endDate)
      .order("expense_date", { ascending: false });

    setLoading(false);
    if (error) {
      toast({ title: "Error fetching expenses", description: error.message, variant: "destructive" });
    } else {
      setExpenses(data || []);
    }
  };

  useEffect(() => {
    fetchExpenses();
  }, [userId, filterMonth]);

  const handleChange = (field: string, value: string) => {
    setFormData({ ...formData, [field]: value });
    setErrors({ ...errors, [field]: "" });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    const validation = expenseSchema.safeParse(formData);
    if (!validation.success) {
      const newErrors: Record<string, string> = {};
      validation.error.errors.forEach((err) => {
        if (err.path[0]) newErrors[err.path[0].toString()] = err.message;
      });
      setErrors(newErrors);
      return;
    }

    setLoading(true);
    const { error } = await supabase.from("expenses").insert({
      user_id: userId,
      expense_date: formData.expense_date,
      category: formData.category,
      description: formData.description.trim(),
      amount: parseFloat(formData.amount),
    });

    setLoading(false);
    if (error) {
      toast({ title: "Error adding expense", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Expense added successfully!" });
      setFormData({
        expense_date: format(new Date(), "yyyy-MM-dd"),
        category: "",
        description: "",
        amount: "",
      });
      setShowForm(false);
      fetchExpenses();
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this expense?")) return;

    setLoading(true);
    const { error } = await supabase.from("expenses").delete().eq("id", id);
    setLoading(false);

    if (error) {
      toast({ title: "Error deleting expense", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Expense deleted successfully" });
      fetchExpenses();
    }
  };

  const exportExpenses = () => {
    if (expenses.length === 0) {
      toast({ title: "No expenses to export", variant: "destructive" });
      return;
    }

    const exportData = expenses.map((expense) => ({
      Date: format(new Date(expense.expense_date), "yyyy-MM-dd"),
      Category: expense.category,
      Description: expense.description,
      Amount: expense.amount,
    }));

    exportToCsv(`expenses_${filterMonth}`, exportData);
    toast({ title: `Exported ${expenses.length} expenses successfully!` });
  };

  const totalExpenses = expenses.reduce((sum, e) => sum + parseFloat(e.amount), 0);
  const expensesByCategory = expenses.reduce((acc: Record<string, number>, e) => {
    acc[e.category] = (acc[e.category] || 0) + parseFloat(e.amount);
    return acc;
  }, {});

  return (
    <div className="space-y-5">
      <Card className="p-5">
        <div className="flex justify-between items-center flex-wrap gap-4">
          <div>
            <h2 className="text-xl font-semibold flex items-center gap-2">
              <TrendingDown className="w-6 h-6 text-destructive" /> Expense Tracking
            </h2>
            <p className="text-muted-foreground text-sm mt-1">Monitor your business costs</p>
          </div>
          <div className="flex gap-2 flex-wrap items-center">
            <Input
              type="month"
              value={filterMonth}
              onChange={(e) => setFilterMonth(e.target.value)}
              className="w-40"
            />
            <Button variant="secondary" size="sm" onClick={exportExpenses}>
              <Download size={16} className="mr-1" /> Export
            </Button>
            <Button onClick={() => setShowForm(!showForm)}>
              <Plus size={16} className="mr-1" /> {showForm ? "Cancel" : "Add Expense"}
            </Button>
          </div>
        </div>
      </Card>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-5 text-center">
          <h3 className="text-muted-foreground text-sm mb-2">Total Expenses</h3>
          <p className="text-2xl font-bold text-destructive">₦{totalExpenses.toFixed(2)}</p>
        </Card>
        <Card className="p-5 text-center">
          <h3 className="text-muted-foreground text-sm mb-2">Expense Count</h3>
          <p className="text-2xl font-bold text-info">{expenses.length}</p>
        </Card>
        <Card className="p-5 text-center">
          <h3 className="text-muted-foreground text-sm mb-2">Avg per Entry</h3>
          <p className="text-2xl font-bold text-warning">
            ₦{expenses.length > 0 ? (totalExpenses / expenses.length).toFixed(2) : "0.00"}
          </p>
        </Card>
        <Card className="p-5 text-center">
          <h3 className="text-muted-foreground text-sm mb-2">Categories Used</h3>
          <p className="text-2xl font-bold text-primary">{Object.keys(expensesByCategory).length}</p>
        </Card>
      </div>

      {/* Category Breakdown */}
      {Object.keys(expensesByCategory).length > 0 && (
        <Card className="p-5">
          <h3 className="font-semibold mb-4">Expense Breakdown by Category</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {Object.entries(expensesByCategory)
              .sort((a, b) => (b[1] as number) - (a[1] as number))
              .map(([category, amount]) => (
                <div key={category} className="bg-muted/50 p-3 rounded-lg">
                  <p className="text-sm text-muted-foreground">{category}</p>
                  <p className="font-semibold">₦{(amount as number).toFixed(2)}</p>
                  <p className="text-xs text-muted-foreground">
                    {(((amount as number) / totalExpenses) * 100).toFixed(1)}%
                  </p>
                </div>
              ))}
          </div>
        </Card>
      )}

      {showForm && (
        <Card className="p-5">
          <h3 className="font-semibold mb-4">Add New Expense</h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <Label>Date *</Label>
                <Input
                  type="date"
                  value={formData.expense_date}
                  onChange={(e) => handleChange("expense_date", e.target.value)}
                  className="mt-2"
                />
                {errors.expense_date && <p className="text-destructive text-sm mt-1">{errors.expense_date}</p>}
              </div>
              <div>
                <Label>Category *</Label>
                <Select value={formData.category} onValueChange={(val) => handleChange("category", val)}>
                  <SelectTrigger className="mt-2">
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {EXPENSE_CATEGORIES.map((cat) => (
                      <SelectItem key={cat} value={cat}>
                        {cat}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.category && <p className="text-destructive text-sm mt-1">{errors.category}</p>}
              </div>
              <div>
                <Label>Description *</Label>
                <Input
                  value={formData.description}
                  onChange={(e) => handleChange("description", e.target.value)}
                  placeholder="What was this expense for?"
                  className="mt-2"
                />
                {errors.description && <p className="text-destructive text-sm mt-1">{errors.description}</p>}
              </div>
              <div>
                <Label>Amount (₦) *</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={formData.amount}
                  onChange={(e) => handleChange("amount", e.target.value)}
                  placeholder="0.00"
                  className="mt-2"
                />
                {errors.amount && <p className="text-destructive text-sm mt-1">{errors.amount}</p>}
              </div>
            </div>
            <Button type="submit" disabled={loading}>
              {loading ? "Adding..." : "Add Expense"}
            </Button>
          </form>
        </Card>
      )}

      <Card className="p-5">
        <h3 className="font-semibold mb-4">Expense History</h3>
        {loading ? (
          <p className="text-center py-4 text-muted-foreground">Loading expenses...</p>
        ) : expenses.length === 0 ? (
          <p className="text-center py-4 text-muted-foreground">No expenses found for this month</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-muted">
                <tr>
                  <th className="p-3 text-left">Date</th>
                  <th className="p-3 text-left">Category</th>
                  <th className="p-3 text-left">Description</th>
                  <th className="p-3 text-left">Amount</th>
                  <th className="p-3 text-left">Actions</th>
                </tr>
              </thead>
              <tbody>
                {expenses.map((expense) => (
                  <tr key={expense.id} className="border-b hover:bg-muted/50">
                    <td className="p-3">{format(new Date(expense.expense_date), "MMM dd, yyyy")}</td>
                    <td className="p-3">
                      <span className="px-2 py-1 bg-muted rounded text-sm">{expense.category}</span>
                    </td>
                    <td className="p-3">{expense.description}</td>
                    <td className="p-3 font-semibold text-destructive">₦{parseFloat(expense.amount).toFixed(2)}</td>
                    <td className="p-3">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(expense.id)}
                        disabled={loading}
                      >
                        <Trash2 size={16} className="text-destructive" />
                      </Button>
                    </td>
                  </tr>
                ))}
                <tr className="bg-destructive/10 font-bold">
                  <td colSpan={3} className="p-3 text-right">Total:</td>
                  <td className="p-3 text-lg text-destructive">₦{totalExpenses.toFixed(2)}</td>
                  <td></td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
};

export default ExpenseTracking;
