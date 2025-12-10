import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Card } from "./ui/card";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { Search, Trash2, CreditCard, History, Download, Filter, X, Mail, MessageCircle } from "lucide-react";
import { z } from "zod";
import PaymentModal from "./PaymentModal";
import PaymentHistory from "./PaymentHistory";
import { exportToCsv } from "@/lib/exportCsv";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";

interface DebtPageProps {
  userId: string;
}

const customerSchema = z.object({
  customer_name: z.string().min(2, "Name must be at least 2 characters").max(100, "Name too long"),
  customer_phone: z.string().min(10, "Phone number must be at least 10 digits").max(15, "Phone number too long"),
});

const itemSchema = z.object({
  item_name: z.string().min(1, "Item name is required").max(100, "Item name too long"),
  quantity: z.string().refine((val) => parseInt(val) >= 1, "Quantity must be at least 1"),
  selling_price: z.string().refine((val) => parseFloat(val) >= 0.01, "Price must be at least 0.01"),
});

const DebtPage = ({ userId }: DebtPageProps) => {
  const [debtors, setDebtors] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("newest");
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [itemErrors, setItemErrors] = useState<Record<string, string>>({});
  const [selectedDebtor, setSelectedDebtor] = useState<any>(null);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [isReminderModalOpen, setIsReminderModalOpen] = useState(false);
  const [reminderEmail, setReminderEmail] = useState("");
  const [sendingReminder, setSendingReminder] = useState(false);
  const [exportStartDate, setExportStartDate] = useState("");
  const [exportEndDate, setExportEndDate] = useState("");
  const [formData, setFormData] = useState({
    customer_name: "",
    customer_phone: "",
    customer_email: "",
    items: [] as any[],
    grand_total: 0,
    payment_amount: "",
  });
  const [currentItem, setCurrentItem] = useState({
    item_date: format(new Date(), "yyyy-MM-dd"),
    item_name: "",
    quantity: "",
    selling_price: "",
  });
  const { toast } = useToast();

  const handleOpenReminder = (debtor: any) => {
    setSelectedDebtor({
      id: debtor.id,
      customer_name: debtor.customer_name,
      customer_phone: debtor.customer_phone,
      current_balance: parseFloat(debtor.current_balance),
    });
    setReminderEmail("");
    setIsReminderModalOpen(true);
  };

  const sendEmailReminder = async () => {
    if (!selectedDebtor || !reminderEmail) {
      toast({ title: "Please enter an email address", variant: "destructive" });
      return;
    }

    setSendingReminder(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-payment-reminder", {
        body: {
          customerName: selectedDebtor.customer_name,
          customerEmail: reminderEmail,
          outstandingBalance: selectedDebtor.current_balance,
        },
      });

      if (error) throw error;

      if (data?.success) {
        toast({ title: "Email reminder sent successfully!" });
        setIsReminderModalOpen(false);
      } else {
        throw new Error(data?.error || "Failed to send email");
      }
    } catch (error: any) {
      console.error("Error sending email:", error);
      toast({ title: "Failed to send email", description: error.message, variant: "destructive" });
    } finally {
      setSendingReminder(false);
    }
  };

  const sendWhatsAppReminder = () => {
    if (!selectedDebtor) return;

    const message = encodeURIComponent(
      `Hi ${selectedDebtor.customer_name},\n\nThis is a friendly reminder that you have an outstanding balance of ₦${selectedDebtor.current_balance.toFixed(2)}.\n\nPlease settle this at your earliest convenience.\n\nThank you!`
    );
    
    // Remove any non-numeric characters from phone
    const phone = selectedDebtor.customer_phone.replace(/\D/g, "");
    const whatsappUrl = `https://wa.me/${phone}?text=${message}`;
    
    window.open(whatsappUrl, "_blank");
    toast({ title: "WhatsApp opened with pre-filled message" });
    setIsReminderModalOpen(false);
  };

  const handlePayment = (debtor: any) => {
    setSelectedDebtor({
      id: debtor.id,
      customer_name: debtor.customer_name,
      current_balance: parseFloat(debtor.current_balance),
      total_paid: parseFloat(debtor.total_paid),
      grand_total: parseFloat(debtor.grand_total),
    });
    setIsPaymentModalOpen(true);
  };

  const handleViewHistory = (debtor: any) => {
    setSelectedDebtor({
      id: debtor.id,
      customer_name: debtor.customer_name,
      current_balance: parseFloat(debtor.current_balance),
      total_paid: parseFloat(debtor.total_paid),
      grand_total: parseFloat(debtor.grand_total),
    });
    setIsHistoryModalOpen(true);
  };

  const fetchDebtors = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("debtors")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    setLoading(false);
    if (error) {
      toast({ title: "Error fetching debtors", description: error.message, variant: "destructive" });
    } else {
      setDebtors(data || []);
    }
  };

  useEffect(() => {
    fetchDebtors();
  }, [userId]);

  const handleCustomerChange = (field: string, value: string) => {
    setFormData({ ...formData, [field]: value });
    setErrors({ ...errors, [field]: "" });
  };

  const handleItemChange = (field: string, value: string) => {
    setCurrentItem({ ...currentItem, [field]: value });
    setItemErrors({ ...itemErrors, [field]: "" });
  };

  const addItemToBundle = () => {
    const validation = itemSchema.safeParse(currentItem);
    if (!validation.success) {
      const newErrors: Record<string, string> = {};
      validation.error.errors.forEach((err) => {
        if (err.path[0]) newErrors[err.path[0].toString()] = err.message;
      });
      setItemErrors(newErrors);
      return;
    }

    const quantity = parseInt(currentItem.quantity);
    const sellingPrice = parseFloat(currentItem.selling_price);
    const total = quantity * sellingPrice;

    const newItem = {
      ...currentItem,
      quantity,
      selling_price: sellingPrice,
      total,
    };

    const updatedItems = [...formData.items, newItem];
    const grandTotal = updatedItems.reduce((sum, item) => sum + item.total, 0);

    setFormData({ ...formData, items: updatedItems, grand_total: grandTotal });
    setCurrentItem({
      item_date: format(new Date(), "yyyy-MM-dd"),
      item_name: "",
      quantity: "",
      selling_price: "",
    });
    setItemErrors({});
    toast({ title: "Item added to bundle" });
  };

  const removeItemFromBundle = (index: number) => {
    const updatedItems = formData.items.filter((_, i) => i !== index);
    const grandTotal = updatedItems.reduce((sum, item) => sum + item.total, 0);
    setFormData({ ...formData, items: updatedItems, grand_total: grandTotal });
  };

  const createDebtor = async () => {
    const customerValidation = customerSchema.safeParse({
      customer_name: formData.customer_name,
      customer_phone: formData.customer_phone,
    });

    if (!customerValidation.success) {
      const newErrors: Record<string, string> = {};
      customerValidation.error.errors.forEach((err) => {
        if (err.path[0]) newErrors[err.path[0].toString()] = err.message;
      });
      setErrors(newErrors);
      return;
    }

    if (formData.items.length === 0) {
      toast({ title: "Please add at least one item", variant: "destructive" });
      return;
    }

    const paymentAmount = parseFloat(formData.payment_amount) || 0;
    if (paymentAmount < 0) {
      setErrors({ ...errors, payment_amount: "Payment amount cannot be negative" });
      return;
    }

    if (paymentAmount > formData.grand_total) {
      setErrors({ ...errors, payment_amount: "Payment cannot exceed grand total" });
      return;
    }

    setLoading(true);
    const currentBalance = formData.grand_total - paymentAmount;
    const status = currentBalance <= 0 ? "paid" : "pending";

    const { data: debtorData, error: debtorError } = await supabase
      .from("debtors")
      .insert({
        user_id: userId,
        customer_name: formData.customer_name.trim(),
        customer_phone: formData.customer_phone.trim(),
        customer_email: formData.customer_email.trim() || null,
        grand_total: formData.grand_total,
        total_paid: paymentAmount,
        current_balance: currentBalance,
        status,
      })
      .select()
      .single();

    if (debtorError) {
      setLoading(false);
      toast({ title: "Error creating debtor", description: debtorError.message, variant: "destructive" });
      return;
    }

    const itemsToInsert = formData.items.map((item) => ({
      debtor_id: debtorData.id,
      item_date: item.item_date,
      item_name: item.item_name.trim(),
      quantity: item.quantity,
      selling_price: item.selling_price,
      total: item.total,
    }));

    const { error: itemsError } = await supabase.from("debt_items").insert(itemsToInsert);

    if (itemsError) {
      setLoading(false);
      toast({ title: "Error adding items", description: itemsError.message, variant: "destructive" });
      return;
    }

    if (paymentAmount > 0) {
      await supabase.from("payments").insert({
        debtor_id: debtorData.id,
        amount: paymentAmount,
      });
    }

    setLoading(false);
    toast({ title: "Debtor created successfully!" });
    setFormData({
      customer_name: "",
      customer_phone: "",
      customer_email: "",
      items: [],
      grand_total: 0,
      payment_amount: "",
    });
    setErrors({});
    fetchDebtors();
  };

  const deleteDebtor = async (id: string) => {
    if (!confirm("Are you sure you want to delete this debtor and all associated records?")) return;
    
    setLoading(true);
    const { error } = await supabase.from("debtors").delete().eq("id", id);
    setLoading(false);
    
    if (error) {
      toast({ title: "Error deleting debtor", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Debtor deleted successfully" });
      fetchDebtors();
    }
  };

  const exportDebtors = () => {
    const exportList = filteredDebtors.length > 0 ? filteredDebtors : debtors;
    if (exportList.length === 0) {
      toast({ title: "No debtors to export", variant: "destructive" });
      return;
    }
    
    // Filter by date range if set
    let dataToExport = exportList;
    if (exportStartDate && exportEndDate) {
      dataToExport = exportList.filter((d) => {
        const createdDate = new Date(d.created_at).toISOString().split("T")[0];
        return createdDate >= exportStartDate && createdDate <= exportEndDate;
      });
      if (dataToExport.length === 0) {
        toast({ title: "No debtors found in selected date range", variant: "destructive" });
        return;
      }
    }

    const exportData = dataToExport.map((debtor) => ({
      "Customer Name": debtor.customer_name,
      "Phone Number": debtor.customer_phone,
      "Grand Total": debtor.grand_total,
      "Total Paid": debtor.total_paid,
      "Current Balance": debtor.current_balance,
      Status: debtor.status,
      "Created Date": format(new Date(debtor.created_at), "yyyy-MM-dd"),
    }));
    
    const dateRange = exportStartDate && exportEndDate 
      ? `${exportStartDate}_to_${exportEndDate}` 
      : format(new Date(), "yyyy-MM-dd");
    exportToCsv(`debtors_report_${dateRange}`, exportData);
    toast({ title: `Exported ${dataToExport.length} debtors successfully!` });
  };

  const calculateStats = () => {
    const totalOutstanding = debtors.reduce((sum, d) => sum + parseFloat(d.current_balance), 0);
    const activeDebtors = debtors.filter((d) => d.status === "pending").length;
    const paidThisMonth = debtors
      .filter((d) => new Date(d.updated_at).getMonth() === new Date().getMonth())
      .reduce((sum, d) => sum + parseFloat(d.total_paid), 0);

    return { totalOutstanding, activeDebtors, paidThisMonth };
  };

  const stats = calculateStats();
  
  const filteredDebtors = debtors
    .filter((d) => {
      // Search filter
      const matchesSearch =
        d.customer_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        d.customer_phone.includes(searchTerm);
      
      // Status filter
      const matchesStatus =
        statusFilter === "all" ||
        d.status === statusFilter;
      
      return matchesSearch && matchesStatus;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case "newest":
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        case "oldest":
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        case "highest":
          return parseFloat(b.current_balance) - parseFloat(a.current_balance);
        case "lowest":
          return parseFloat(a.current_balance) - parseFloat(b.current_balance);
        case "name":
          return a.customer_name.localeCompare(b.customer_name);
        default:
          return 0;
      }
    });

  const clearFilters = () => {
    setSearchTerm("");
    setStatusFilter("all");
    setSortBy("newest");
  };

  const hasActiveFilters = searchTerm || statusFilter !== "all" || sortBy !== "newest";

  const currentBalance = formData.grand_total - (parseFloat(formData.payment_amount) || 0);

  return (
    <div className="space-y-5">
      <Card className="p-5">
        <div className="flex justify-between items-start flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-bold text-primary">💰 Debt Management</h1>
            <p className="text-muted-foreground mt-2">Track customer debts and manage payments efficiently</p>
          </div>
          <div className="flex flex-wrap items-end gap-2">
            <div>
              <Label className="text-xs">From</Label>
              <Input
                type="date"
                value={exportStartDate}
                onChange={(e) => setExportStartDate(e.target.value)}
                className="w-36 h-9"
              />
            </div>
            <div>
              <Label className="text-xs">To</Label>
              <Input
                type="date"
                value={exportEndDate}
                onChange={(e) => setExportEndDate(e.target.value)}
                className="w-36 h-9"
              />
            </div>
            <Button variant="secondary" size="sm" onClick={exportDebtors}>
              <Download size={16} className="mr-2" /> Export CSV
            </Button>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <Card className="p-5 text-center">
          <h3 className="text-muted-foreground text-sm mb-2">Total Outstanding</h3>
          <p className="text-3xl font-bold text-primary">₦{stats.totalOutstanding.toFixed(2)}</p>
        </Card>
        <Card className="p-5 text-center">
          <h3 className="text-muted-foreground text-sm mb-2">Paid This Month</h3>
          <p className="text-3xl font-bold text-success">₦{stats.paidThisMonth.toFixed(2)}</p>
        </Card>
        <Card className="p-5 text-center">
          <h3 className="text-muted-foreground text-sm mb-2">Active Debtors</h3>
          <p className="text-3xl font-bold text-info">{stats.activeDebtors}</p>
        </Card>
      </div>

      {/* Search and Filters */}
      <Card className="p-5">
        <div className="flex flex-wrap gap-4 items-end">
          <div className="flex-1 min-w-[200px]">
            <Label className="text-sm">Search</Label>
            <div className="relative mt-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search by name or phone..."
                className="pl-9"
              />
            </div>
          </div>
          <div className="w-[140px]">
            <Label className="text-sm">Status</Label>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="paid">Paid</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="w-[160px]">
            <Label className="text-sm">Sort By</Label>
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="newest">Newest First</SelectItem>
                <SelectItem value="oldest">Oldest First</SelectItem>
                <SelectItem value="highest">Highest Balance</SelectItem>
                <SelectItem value="lowest">Lowest Balance</SelectItem>
                <SelectItem value="name">Name (A-Z)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {hasActiveFilters && (
            <Button variant="ghost" size="sm" onClick={clearFilters} className="h-10">
              <X className="w-4 h-4 mr-1" /> Clear
            </Button>
          )}
        </div>
        {filteredDebtors.length !== debtors.length && (
          <p className="text-sm text-muted-foreground mt-3">
            Showing {filteredDebtors.length} of {debtors.length} debtors
          </p>
        )}
      </Card>

      <Card className="p-5">
        <h2 className="text-xl font-semibold mb-4">Add New Debt</h2>
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label>Customer Name *</Label>
              <Input
                value={formData.customer_name}
                onChange={(e) => handleCustomerChange("customer_name", e.target.value)}
                placeholder="Enter customer name"
                className="mt-2"
              />
              {errors.customer_name && <p className="text-destructive text-sm mt-1">{errors.customer_name}</p>}
            </div>
            <div>
              <Label>Phone Number *</Label>
              <Input
                value={formData.customer_phone}
                onChange={(e) => handleCustomerChange("customer_phone", e.target.value)}
                placeholder="Enter phone number"
                className="mt-2"
              />
              {errors.customer_phone && <p className="text-destructive text-sm mt-1">{errors.customer_phone}</p>}
            </div>
            <div>
              <Label>Email (for reminders)</Label>
              <Input
                type="email"
                value={formData.customer_email}
                onChange={(e) => handleCustomerChange("customer_email", e.target.value)}
                placeholder="customer@email.com"
                className="mt-2"
              />
            </div>
          </div>

          <h3 className="font-semibold mt-6">Add Items</h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <Label>Date</Label>
              <Input
                type="date"
                value={currentItem.item_date}
                onChange={(e) => handleItemChange("item_date", e.target.value)}
                className="mt-2"
              />
            </div>
            <div>
              <Label>Item Name *</Label>
              <Input
                value={currentItem.item_name}
                onChange={(e) => handleItemChange("item_name", e.target.value)}
                placeholder="Enter item name"
                className="mt-2"
              />
              {itemErrors.item_name && <p className="text-destructive text-sm mt-1">{itemErrors.item_name}</p>}
            </div>
            <div>
              <Label>Quantity *</Label>
              <Input
                type="number"
                min="1"
                value={currentItem.quantity}
                onChange={(e) => handleItemChange("quantity", e.target.value)}
                placeholder="1"
                className="mt-2"
              />
              {itemErrors.quantity && <p className="text-destructive text-sm mt-1">{itemErrors.quantity}</p>}
            </div>
            <div>
              <Label>Selling Price (₦) *</Label>
              <Input
                type="number"
                step="0.01"
                min="0.01"
                value={currentItem.selling_price}
                onChange={(e) => handleItemChange("selling_price", e.target.value)}
                placeholder="0.00"
                className="mt-2"
              />
              {itemErrors.selling_price && <p className="text-destructive text-sm mt-1">{itemErrors.selling_price}</p>}
            </div>
          </div>
          <Button onClick={addItemToBundle} variant="secondary">Add Item to Bundle</Button>

          {formData.items.length > 0 && (
            <div className="mt-4">
              <h4 className="font-semibold mb-2">Items Added ({formData.items.length}):</h4>
              <ul className="space-y-2">
                {formData.items.map((item, index) => (
                  <li key={index} className="bg-muted p-3 rounded flex justify-between items-center">
                    <span>
                      {item.item_name} - Qty: {item.quantity} - Price: ₦{item.selling_price.toFixed(2)} - Total: ₦
                      {item.total.toFixed(2)}
                    </span>
                    <Button variant="ghost" size="sm" onClick={() => removeItemFromBundle(index)}>
                      <Trash2 size={16} className="text-destructive" />
                    </Button>
                  </li>
                ))}
              </ul>

              <div className="mt-4 space-y-3">
                <div>
                  <Label>Grand Total</Label>
                  <Input value={`₦${formData.grand_total.toFixed(2)}`} disabled className="mt-2 font-bold" />
                </div>
                <div>
                  <Label>Initial Payment Amount (Optional)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.payment_amount}
                    onChange={(e) => handleCustomerChange("payment_amount", e.target.value)}
                    placeholder="0.00"
                    className="mt-2"
                  />
                  {errors.payment_amount && <p className="text-destructive text-sm mt-1">{errors.payment_amount}</p>}
                </div>
                <div>
                  <Label>Current Balance</Label>
                  <Input
                    value={`₦${currentBalance.toFixed(2)}`}
                    disabled
                    className={`mt-2 font-bold ${currentBalance > 0 ? "text-warning" : "text-success"}`}
                  />
                </div>
                <Button onClick={createDebtor} className="w-full md:w-auto" disabled={loading}>
                  {loading ? "Creating..." : "Create Debtor"}
                </Button>
              </div>
            </div>
          )}
        </div>
      </Card>

      <Card className="p-5">
        <h2 className="text-xl font-semibold mb-4">Debtors List</h2>
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" size={20} />
          <Input
            placeholder="Search by name or phone number"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>

        {filteredDebtors.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">No debtors found</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredDebtors.map((debtor) => (
              <Card key={debtor.id} className="p-4 border-l-4 border-primary">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h3 className="font-semibold text-lg">{debtor.customer_name}</h3>
                    <p className="text-sm text-muted-foreground">{debtor.customer_phone}</p>
                  </div>
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-semibold ${
                      debtor.status === "paid" ? "bg-success text-white" : "bg-warning text-white"
                    }`}
                  >
                    {debtor.status}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground mb-3">
                  {format(new Date(debtor.created_at), "MMM dd, yyyy")}
                </p>
                <div className="grid grid-cols-3 gap-2 mb-4">
                  <div className="text-center">
                    <p className="text-xs text-muted-foreground">Total</p>
                    <p className="font-semibold">₦{parseFloat(debtor.grand_total).toFixed(2)}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-muted-foreground">Paid</p>
                    <p className="font-semibold text-success">₦{parseFloat(debtor.total_paid).toFixed(2)}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-muted-foreground">Balance</p>
                    <p className="font-semibold text-warning">₦{parseFloat(debtor.current_balance).toFixed(2)}</p>
                  </div>
                </div>
                <div className="flex gap-2 flex-wrap">
                  {debtor.status === "pending" && (
                    <>
                      <Button 
                        variant="default" 
                        size="sm" 
                        onClick={() => handlePayment(debtor)} 
                        disabled={loading}
                        className="flex-1"
                      >
                        <CreditCard size={14} className="mr-1" /> Pay
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => handleOpenReminder(debtor)} 
                        disabled={loading}
                        className="flex-1"
                      >
                        <MessageCircle size={14} className="mr-1" /> Remind
                      </Button>
                    </>
                  )}
                  <Button 
                    variant="secondary" 
                    size="sm" 
                    onClick={() => handleViewHistory(debtor)} 
                    disabled={loading}
                    className="flex-1"
                  >
                    <History size={14} className="mr-1" /> History
                  </Button>
                  <Button 
                    variant="destructive" 
                    size="sm" 
                    onClick={() => deleteDebtor(debtor.id)} 
                    disabled={loading}
                    className="flex-1"
                  >
                    <Trash2 size={14} className="mr-1" /> Delete
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </Card>

      <PaymentModal
        isOpen={isPaymentModalOpen}
        onClose={() => setIsPaymentModalOpen(false)}
        debtor={selectedDebtor}
        onPaymentSuccess={fetchDebtors}
      />

      <PaymentHistory
        isOpen={isHistoryModalOpen}
        onClose={() => setIsHistoryModalOpen(false)}
        debtor={selectedDebtor}
      />

      {/* Reminder Modal */}
      <Dialog open={isReminderModalOpen} onOpenChange={setIsReminderModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send Payment Reminder</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div>
              <p className="text-sm text-muted-foreground mb-2">
                Send a reminder to <span className="font-semibold">{selectedDebtor?.customer_name}</span>
              </p>
              <p className="text-lg font-bold text-warning mb-4">
                Outstanding: ₦{selectedDebtor?.current_balance?.toFixed(2)}
              </p>
            </div>

            <div className="space-y-3">
              <div>
                <Label>Email Address</Label>
                <Input
                  type="email"
                  value={reminderEmail}
                  onChange={(e) => setReminderEmail(e.target.value)}
                  placeholder="customer@email.com"
                  className="mt-2"
                />
              </div>
              
              <Button 
                onClick={sendEmailReminder} 
                disabled={sendingReminder || !reminderEmail}
                className="w-full"
              >
                <Mail size={16} className="mr-2" />
                {sendingReminder ? "Sending..." : "Send Email Reminder"}
              </Button>
              
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-background px-2 text-muted-foreground">Or</span>
                </div>
              </div>

              <Button 
                variant="secondary" 
                onClick={sendWhatsAppReminder}
                className="w-full"
              >
                <MessageCircle size={16} className="mr-2" />
                Send via WhatsApp
              </Button>
              <p className="text-xs text-muted-foreground text-center">
                Phone: {selectedDebtor?.customer_phone}
              </p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default DebtPage;