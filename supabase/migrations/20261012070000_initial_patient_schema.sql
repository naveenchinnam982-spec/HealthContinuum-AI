-- HealthContinuum AI: initial patient schema for Supabase.
-- Auth credentials live only in auth.users. Never store passwords in public tables.

CREATE TABLE IF NOT EXISTS public.patient_profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL CHECK (char_length(trim(full_name)) BETWEEN 2 AND 200),
  phone text,
  uhid text UNIQUE,
  date_of_birth date,
  gender text,
  blood_group text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.patient_visits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL REFERENCES public.patient_profiles(id) ON DELETE CASCADE,
  visit_date date, hospital_name text, doctor_name text, visit_type text, summary text,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.medications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL REFERENCES public.patient_profiles(id) ON DELETE CASCADE,
  visit_id uuid REFERENCES public.patient_visits(id) ON DELETE SET NULL,
  name text NOT NULL, dosage text, frequency text,
  status text NOT NULL DEFAULT 'CURRENT', prescribed_at date, notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.lab_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL REFERENCES public.patient_profiles(id) ON DELETE CASCADE,
  visit_id uuid REFERENCES public.patient_visits(id) ON DELETE SET NULL,
  test_name text NOT NULL, result_value text, unit text, reference_range text,
  status text, recorded_at date, notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.medical_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL REFERENCES public.patient_profiles(id) ON DELETE CASCADE,
  visit_id uuid REFERENCES public.patient_visits(id) ON DELETE SET NULL,
  document_name text NOT NULL, document_type text NOT NULL DEFAULT 'OTHER',
  storage_path text, mime_type text,
  file_size_bytes bigint CHECK (file_size_bytes IS NULL OR file_size_bytes >= 0),
  uploaded_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS patient_visits_patient_date_idx ON public.patient_visits (patient_id, visit_date DESC);
CREATE INDEX IF NOT EXISTS medications_patient_status_idx ON public.medications (patient_id, status);
CREATE INDEX IF NOT EXISTS lab_results_patient_date_idx ON public.lab_results (patient_id, recorded_at DESC);
CREATE INDEX IF NOT EXISTS medical_documents_patient_uploaded_idx ON public.medical_documents (patient_id, uploaded_at DESC);

ALTER TABLE public.patient_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patient_visits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.medications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lab_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.medical_documents ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.patient_profiles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.patient_visits TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.medications TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lab_results TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.medical_documents TO authenticated;

DROP POLICY IF EXISTS "Patients manage own profile" ON public.patient_profiles;
CREATE POLICY "Patients manage own profile" ON public.patient_profiles FOR ALL TO authenticated
USING (id = (SELECT auth.uid())) WITH CHECK (id = (SELECT auth.uid()));
DROP POLICY IF EXISTS "Patients manage own visits" ON public.patient_visits;
CREATE POLICY "Patients manage own visits" ON public.patient_visits FOR ALL TO authenticated
USING (patient_id = (SELECT auth.uid())) WITH CHECK (patient_id = (SELECT auth.uid()));
DROP POLICY IF EXISTS "Patients manage own medications" ON public.medications;
CREATE POLICY "Patients manage own medications" ON public.medications FOR ALL TO authenticated
USING (patient_id = (SELECT auth.uid())) WITH CHECK (patient_id = (SELECT auth.uid()));
DROP POLICY IF EXISTS "Patients manage own labs" ON public.lab_results;
CREATE POLICY "Patients manage own labs" ON public.lab_results FOR ALL TO authenticated
USING (patient_id = (SELECT auth.uid())) WITH CHECK (patient_id = (SELECT auth.uid()));
DROP POLICY IF EXISTS "Patients manage own documents" ON public.medical_documents;
CREATE POLICY "Patients manage own documents" ON public.medical_documents FOR ALL TO authenticated
USING (patient_id = (SELECT auth.uid())) WITH CHECK (patient_id = (SELECT auth.uid()));

CREATE OR REPLACE FUNCTION public.handle_new_patient_auth_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.patient_profiles (id, full_name, phone)
  VALUES (
    NEW.id,
    COALESCE(NULLIF(trim(NEW.raw_user_meta_data ->> 'full_name'), ''), NULLIF(split_part(COALESCE(NEW.email, ''), '@', 1), ''), 'Patient'),
    NULLIF(trim(COALESCE(NEW.phone, NEW.raw_user_meta_data ->> 'phone', '')), '')
  ) ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.handle_new_patient_auth_user() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS on_auth_user_created_patient_profile ON auth.users;
CREATE TRIGGER on_auth_user_created_patient_profile AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_patient_auth_user();
