-- ============================================================
-- AKTIFKAN ROW LEVEL SECURITY (RLS) - Tambang PWA
-- Jalankan file ini di: Supabase Dashboard > SQL Editor
-- Otomatis melewati tabel yang belum dibuat di Supabase.
-- ============================================================

DO $$
DECLARE
  tbl  TEXT;
  pol  TEXT;
  ops  TEXT[] := ARRAY['SELECT','INSERT','UPDATE','DELETE'];
  op   TEXT;
  chk  TEXT;
BEGIN
  -- Daftar semua tabel yang seharusnya dilindungi
  FOR tbl IN SELECT unnest(ARRAY[
    'units', 'service_logs', 'solar_logs', 'cost_logs',
    'inspections', 'spare_parts', 'spare_stock',
    'daily_notes', 'ritase_logs', 'transaksi_logs'
  ])
  LOOP
    -- Lewati jika tabel belum ada
    IF NOT EXISTS (
      SELECT 1 FROM pg_tables
      WHERE schemaname = 'public' AND tablename = tbl
    ) THEN
      RAISE NOTICE 'SKIP: tabel "%" belum ada, dilewati.', tbl;
      CONTINUE;
    END IF;

    -- Aktifkan RLS
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', tbl);

    -- Hapus policy lama supaya tidak duplikat
    FOR pol IN
      SELECT policyname FROM pg_policies
      WHERE schemaname = 'public' AND tablename = tbl
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON %I', pol, tbl);
    END LOOP;

    -- Buat policy untuk setiap operasi
    FOREACH op IN ARRAY ops LOOP
      IF op = 'INSERT' THEN
        chk := format(
          'CREATE POLICY %I ON %I FOR %s TO anon WITH CHECK (true)',
          'anon_' || lower(op) || '_' || tbl, tbl, op
        );
      ELSIF op = 'UPDATE' THEN
        chk := format(
          'CREATE POLICY %I ON %I FOR %s TO anon USING (true) WITH CHECK (true)',
          'anon_' || lower(op) || '_' || tbl, tbl, op
        );
      ELSE
        chk := format(
          'CREATE POLICY %I ON %I FOR %s TO anon USING (true)',
          'anon_' || lower(op) || '_' || tbl, tbl, op
        );
      END IF;
      EXECUTE chk;
    END LOOP;

    RAISE NOTICE 'OK: RLS aktif pada tabel "%"', tbl;
  END LOOP;
END $$;

-- ============================================================
-- VERIFIKASI — tampilkan status RLS setiap tabel
-- ============================================================
SELECT
  t.tablename,
  t.rowsecurity                                            AS rls_aktif,
  (
    SELECT count(*) FROM pg_policies p
    WHERE p.schemaname = 'public' AND p.tablename = t.tablename
  )                                                        AS jumlah_policy
FROM pg_tables t
WHERE t.schemaname = 'public'
  AND t.tablename IN (
    'units', 'service_logs', 'solar_logs', 'cost_logs',
    'inspections', 'spare_parts', 'spare_stock',
    'daily_notes', 'ritase_logs', 'transaksi_logs'
  )
ORDER BY t.tablename;
