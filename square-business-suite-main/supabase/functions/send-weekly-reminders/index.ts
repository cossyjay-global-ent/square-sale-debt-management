import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("Starting weekly reminder job...");

    if (!RESEND_API_KEY) {
      throw new Error("RESEND_API_KEY is not configured");
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Fetch all pending debtors with email addresses
    const { data: debtors, error: fetchError } = await supabase
      .from("debtors")
      .select("id, customer_name, customer_email, current_balance, user_id")
      .eq("status", "pending")
      .gt("current_balance", 0)
      .not("customer_email", "is", null);

    if (fetchError) {
      console.error("Error fetching debtors:", fetchError);
      throw fetchError;
    }

    console.log(`Found ${debtors?.length || 0} debtors with pending balances and email addresses`);

    const results = {
      total: debtors?.length || 0,
      sent: 0,
      failed: 0,
      errors: [] as string[],
    };

    for (const debtor of debtors || []) {
      if (!debtor.customer_email) continue;

      try {
        const emailHtml = `
          <!DOCTYPE html>
          <html>
            <head>
              <style>
                body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                .header { background: #1a1a2e; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
                .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
                .amount { font-size: 28px; font-weight: bold; color: #e63946; margin: 20px 0; }
                .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
              </style>
            </head>
            <body>
              <div class="container">
                <div class="header">
                  <h1>Weekly Payment Reminder</h1>
                </div>
                <div class="content">
                  <p>Dear <strong>${debtor.customer_name}</strong>,</p>
                  <p>This is your weekly reminder that you have an outstanding balance with us.</p>
                  <p class="amount">Outstanding Balance: ₦${parseFloat(debtor.current_balance).toFixed(2)}</p>
                  <p>We kindly request you to settle this balance at your earliest convenience.</p>
                  <p>If you have already made a payment, please disregard this message.</p>
                  <p>Thank you for your prompt attention to this matter.</p>
                  <p>Best regards,<br>The Team</p>
                </div>
                <div class="footer">
                  <p>This is an automated weekly reminder.</p>
                </div>
              </div>
            </body>
          </html>
        `;

        const response = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${RESEND_API_KEY}`,
          },
          body: JSON.stringify({
            from: "Payment Reminder <onboarding@resend.dev>",
            to: [debtor.customer_email],
            subject: `Weekly Payment Reminder - Outstanding Balance: ₦${parseFloat(debtor.current_balance).toFixed(2)}`,
            html: emailHtml,
          }),
        });

        if (response.ok) {
          results.sent++;
          console.log(`Email sent to ${debtor.customer_email}`);
        } else {
          const errorData = await response.json();
          results.failed++;
          results.errors.push(`${debtor.customer_email}: ${errorData.message}`);
          console.error(`Failed to send to ${debtor.customer_email}:`, errorData);
        }
      } catch (emailError: any) {
        results.failed++;
        results.errors.push(`${debtor.customer_email}: ${emailError.message}`);
        console.error(`Error sending to ${debtor.customer_email}:`, emailError);
      }
    }

    console.log(`Weekly reminders complete. Sent: ${results.sent}, Failed: ${results.failed}`);

    return new Response(JSON.stringify({ success: true, results }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("Error in weekly reminders:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
