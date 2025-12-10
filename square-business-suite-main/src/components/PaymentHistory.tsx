import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "./ui/button";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";

interface PaymentHistoryProps {
  isOpen: boolean;
  onClose: () => void;
  debtor: {
    id: string;
    customer_name: string;
    grand_total: number;
    total_paid: number;
    current_balance: number;
  } | null;
}

interface Payment {
  id: string;
  amount: number;
  payment_date: string;
  created_at: string;
}

const PaymentHistory = ({ isOpen, onClose, debtor }: PaymentHistoryProps) => {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const fetchPayments = async () => {
    if (!debtor) return;
    
    setLoading(true);
    const { data, error } = await supabase
      .from("payments")
      .select("*")
      .eq("debtor_id", debtor.id)
      .order("created_at", { ascending: false });

    setLoading(false);
    if (error) {
      toast({ title: "Error fetching payments", description: error.message, variant: "destructive" });
    } else {
      setPayments(data || []);
    }
  };

  useEffect(() => {
    if (isOpen && debtor) {
      fetchPayments();
    }
  }, [isOpen, debtor]);

  if (!debtor) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Payment History - {debtor.customer_name}</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-4 bg-muted p-4 rounded-lg">
            <div className="text-center">
              <p className="text-xs text-muted-foreground">Grand Total</p>
              <p className="font-bold">₦{debtor.grand_total.toFixed(2)}</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-muted-foreground">Total Paid</p>
              <p className="font-bold text-success">₦{debtor.total_paid.toFixed(2)}</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-muted-foreground">Balance</p>
              <p className="font-bold text-warning">₦{debtor.current_balance.toFixed(2)}</p>
            </div>
          </div>

          {loading ? (
            <p className="text-center text-muted-foreground py-4">Loading payments...</p>
          ) : payments.length === 0 ? (
            <p className="text-center text-muted-foreground py-4">No payments recorded yet</p>
          ) : (
            <div className="max-h-64 overflow-y-auto">
              <table className="w-full">
                <thead className="bg-muted sticky top-0">
                  <tr>
                    <th className="p-2 text-left text-sm">Date</th>
                    <th className="p-2 text-right text-sm">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map((payment) => (
                    <tr key={payment.id} className="border-b">
                      <td className="p-2 text-sm">
                        {format(new Date(payment.created_at), "MMM dd, yyyy HH:mm")}
                      </td>
                      <td className="p-2 text-right text-sm font-semibold text-success">
                        +₦{parseFloat(String(payment.amount)).toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <Button onClick={onClose} className="w-full">Close</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default PaymentHistory;
