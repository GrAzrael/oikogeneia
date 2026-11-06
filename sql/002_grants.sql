grant usage on schema public to authenticated;
grant select, insert, update, delete on
  public.members, public.documents, public.lab_results, public.targets, public.medications, public.med_logs,
  public.meals, public.wellbeing, public.measurements, public.appointments, public.shopping_items,
  public.household_items, public.advisor_notes
to authenticated;
grant select on public.v_latest_results to authenticated;
revoke all on all tables in schema public from anon;
revoke truncate, references, trigger on all tables in schema public from authenticated;
