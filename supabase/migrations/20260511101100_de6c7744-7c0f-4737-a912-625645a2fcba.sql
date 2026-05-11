-- Lock down user_roles: only admins can manage; the assign_first_user_admin trigger still works because it's SECURITY DEFINER
CREATE POLICY "Admins can insert user roles"
  ON public.user_roles FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update user roles"
  ON public.user_roles FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete user roles"
  ON public.user_roles FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Realtime: menu data is fully public (anon can SELECT), so allow read-only subscriptions to the public-data topics.
CREATE POLICY "Public can read menu realtime broadcasts"
  ON realtime.messages FOR SELECT
  TO anon, authenticated
  USING (true);