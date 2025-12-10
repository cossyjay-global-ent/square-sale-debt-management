import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "./ui/button";
import { Label } from "./ui/label";
import { Input } from "./ui/input";
import { Card } from "./ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { useToast } from "@/hooks/use-toast";

interface SettingsPageProps {
  userId: string;
}

const currencies = [
  { value: "NGN", label: "NGN (₦)" },
  { value: "USD", label: "USD ($)" },
  { value: "EUR", label: "EUR (€)" },
  { value: "GBP", label: "GBP (£)" },
  { value: "CAD", label: "CAD ($)" },
  { value: "AUD", label: "AUD ($)" },
  { value: "INR", label: "INR (₹)" },
  { value: "JPY", label: "JPY (¥)" },
  { value: "CNY", label: "CNY (¥)" },
  { value: "ZAR", label: "ZAR (R)" },
  { value: "KES", label: "KES (KSh)" },
  { value: "GHS", label: "GHS (₵)" },
];

const SettingsPage = ({ userId }: SettingsPageProps) => {
  const [settings, setSettings] = useState({ theme: "light", currency: "NGN", profit_margin_goal: 20 });
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    const fetchSettings = async () => {
      setInitialLoading(true);
      const { data, error } = await supabase
        .from("user_settings")
        .select("*")
        .eq("user_id", userId)
        .single();

      setInitialLoading(false);
      if (data) {
        setSettings({ 
          theme: data.theme || "light", 
          currency: data.currency || "NGN",
          profit_margin_goal: data.profit_margin_goal ?? 20
        });
      } else if (error && error.code !== "PGRST116") {
        // PGRST116 means no rows returned, which is expected for new users
        toast({ title: "Error loading settings", description: error.message, variant: "destructive" });
      }
    };

    fetchSettings();
  }, [userId]);

  const handleSave = async () => {
    if (!settings.theme || !settings.currency) {
      toast({ title: "Please select both theme and currency", variant: "destructive" });
      return;
    }

    setLoading(true);
    
    // Check if settings exist
    const { data: existingSettings } = await supabase
      .from("user_settings")
      .select("id")
      .eq("user_id", userId)
      .single();

    let error;
    if (existingSettings) {
      // Update existing settings
      const result = await supabase
        .from("user_settings")
        .update(settings)
        .eq("user_id", userId);
      error = result.error;
    } else {
      // Insert new settings
      const result = await supabase
        .from("user_settings")
        .insert({ user_id: userId, ...settings });
      error = result.error;
    }

    setLoading(false);
    if (error) {
      toast({ title: "Error saving settings", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Settings saved successfully!" });
    }
  };

  if (initialLoading) {
    return (
      <div className="space-y-5">
        <Card className="p-5">
          <h1 className="text-3xl font-bold text-primary">⚙️ Settings</h1>
          <p className="text-muted-foreground mt-2">Loading settings...</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <Card className="p-5">
        <h1 className="text-3xl font-bold text-primary">⚙️ Settings</h1>
        <p className="text-muted-foreground mt-2">Application settings and configuration options</p>
      </Card>

      <Card className="p-5">
        <div className="space-y-6">
          <div>
            <Label>Theme</Label>
            <Select value={settings.theme} onValueChange={(value) => setSettings({ ...settings, theme: value })}>
              <SelectTrigger className="mt-2">
                <SelectValue placeholder="Select theme" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="light">Light Mode</SelectItem>
                <SelectItem value="dark">Dark Mode</SelectItem>
                <SelectItem value="system">System Default</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Default Currency</Label>
            <Select
              value={settings.currency}
              onValueChange={(value) => setSettings({ ...settings, currency: value })}
            >
              <SelectTrigger className="mt-2">
                <SelectValue placeholder="Select currency" />
              </SelectTrigger>
              <SelectContent>
                {currencies.map((currency) => (
                  <SelectItem key={currency.value} value={currency.value}>
                    {currency.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Profit Margin Goal (%)</Label>
            <Input
              type="number"
              min="0"
              max="100"
              value={settings.profit_margin_goal}
              onChange={(e) => setSettings({ ...settings, profit_margin_goal: parseFloat(e.target.value) || 0 })}
              className="mt-2"
              placeholder="20"
            />
            <p className="text-sm text-muted-foreground mt-1">
              You'll be alerted when profit margins fall below this target
            </p>
          </div>

          <Button onClick={handleSave} disabled={loading}>
            {loading ? "Saving..." : "Save Settings"}
          </Button>
        </div>
      </Card>
    </div>
  );
};

export default SettingsPage;