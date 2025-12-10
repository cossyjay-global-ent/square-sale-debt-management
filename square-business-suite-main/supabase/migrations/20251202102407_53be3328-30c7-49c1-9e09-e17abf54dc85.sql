-- RLS policies for debtors table
CREATE POLICY "Users can view their own debtors" 
ON public.debtors 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own debtors" 
ON public.debtors 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own debtors" 
ON public.debtors 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own debtors" 
ON public.debtors 
FOR DELETE 
USING (auth.uid() = user_id);

-- RLS policies for debt_items table
CREATE POLICY "Users can view their own debt items" 
ON public.debt_items 
FOR SELECT 
USING (debtor_id IN (SELECT id FROM public.debtors WHERE user_id = auth.uid()));

CREATE POLICY "Users can create debt items for their debtors" 
ON public.debt_items 
FOR INSERT 
WITH CHECK (debtor_id IN (SELECT id FROM public.debtors WHERE user_id = auth.uid()));

CREATE POLICY "Users can update their own debt items" 
ON public.debt_items 
FOR UPDATE 
USING (debtor_id IN (SELECT id FROM public.debtors WHERE user_id = auth.uid()));

CREATE POLICY "Users can delete their own debt items" 
ON public.debt_items 
FOR DELETE 
USING (debtor_id IN (SELECT id FROM public.debtors WHERE user_id = auth.uid()));

-- RLS policies for payments table
CREATE POLICY "Users can view their own payments" 
ON public.payments 
FOR SELECT 
USING (debtor_id IN (SELECT id FROM public.debtors WHERE user_id = auth.uid()));

CREATE POLICY "Users can create payments for their debtors" 
ON public.payments 
FOR INSERT 
WITH CHECK (debtor_id IN (SELECT id FROM public.debtors WHERE user_id = auth.uid()));

CREATE POLICY "Users can update their own payments" 
ON public.payments 
FOR UPDATE 
USING (debtor_id IN (SELECT id FROM public.debtors WHERE user_id = auth.uid()));

CREATE POLICY "Users can delete their own payments" 
ON public.payments 
FOR DELETE 
USING (debtor_id IN (SELECT id FROM public.debtors WHERE user_id = auth.uid()));