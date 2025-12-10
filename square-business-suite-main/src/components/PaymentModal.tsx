import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import { z } from "zod";

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  debtor: {
    id: string;
    customer_name: string;
    current_balance: number;
    total_paid: number;
  } | null;
  onPaymentSuccess: () => void;
}

const paymentSchema = z.object({
  amount: z.number().min(0.01, "Amount must be at least 0.01"),
});

const PaymentModal = ({ isOpen, onClose, debtor, onPaymentSuccess }: PaymentModalProps) => {
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!debtor) return;

    const paymentAmount = parseFloat(amount);
    const validation = paymentSchema.safeParse({ amount: paymentAmount });

    if (!validation.success) {
      setError(validation.error.errors[0].message);
      return;
    }

    if (paymentAmount > debtor.current_balance) {
      setError("Payment cannot exceed current balance");
      return;
    }

    setLoading(true);

    // Insert payment record
    const { error: paymentError } = await supabase.from("payments").insert({
      debtor_id: debtor.id,
      amount: paymentAmount,
    });

    if (paymentError) {
      setLoading(false);
      toast({ title: "Error recording payment", description: paymentError.message, variant: "destructive" });
      return;
    }

    // Update debtor balance
    const newTotalPaid = debtor.total_paid + paymentAmount;
    const newBalance = debtor.current_balance - paymentAmount;
    const newStatus = newBalance <= 0 ? "paid" : "pending";

    const { error: updateError } = await supabase
      .from("debtors")
      .update({
        total_paid: newTotalPaid,
        current_balance: newBalance,
        status: newStatus,
      })
      .eq("id", debtor.id);

    setLoading(false);

    if (updateError) {
      toast({ title: "Error updating debtor", description: updateError.message, variant: "destructive" });
      return;
    }

    toast({ title: "Payment recorded successfully!" });
    setAmount("");
    onPaymentSuccess();
    onClose();
  };

  if (!debtor) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Record Payment - {debtor.customer_name}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="bg-muted p-4 rounded-lg space-y-2">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Current Balance:</span>
              <span className="font-bold text-warning">₦{debtor.current_balance.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Total Paid:</span>
              <span className="font-bold text-success">₦{debtor.total_paid.toFixed(2)}</span>
            </div>
          </div>

          <div>
            <Label>Payment Amount (₦)</Label>
            <Input
              type="number"
              step="0.01"
              min="0.01"
              max={debtor.current_balance}
              value={amount}
              onChange={(e) => {
                setAmount(e.target.value);
                setError("");
              }}
              placeholder="Enter payment amount"
              className="mt-2"
            />
            {error && <p className="text-destructive text-sm mt-1">{error}</p>}
          </div>

          {amount && parseFloat(amount) > 0 && (
            <div className="bg-muted p-4 rounded-lg">
              <div className="flex justify-between">
                <span className="text-muted-foreground">New Balance:</span>
                <span className="font-bold">
                  ₦{(debtor.current_balance - parseFloat(amount)).toFixed(2)}
                </span>
              </div>
            </div>
          )}

          <div className="flex gap-3">
            <Button type="button" variant="secondary" onClick={onClose} className="flex-1">
              Cancel
            </Button>
            <Button type="submit" className="flex-1" disabled={loading}>
              {loading ? "Processing..." : "Record Payment"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default PaymentModal;
