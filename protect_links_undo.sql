
BEGIN;

DO $undo$
BEGIN
  IF to_regclass('public.items_links_backup_20261125_1940') IS NULL
     OR to_regclass('public.game_links_backup_20261125_1940') IS NULL THEN
    RAISE EXCEPTION 'Backup tables missing; rollback stopped safely';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.items_links_backup_20261125_1940 b
    LEFT JOIN public.items i ON i.id = b.id
    WHERE i.id IS NULL
  ) THEN
    RAISE EXCEPTION 'Some original items are missing; rollback stopped';
  END IF;

  UPDATE public.items i
  SET data = b.data
  FROM public.items_links_backup_20261125_1940 b
  WHERE i.id = b.id;

  DELETE FROM public.game_links;

  INSERT INTO public.game_links (item_id, links, updated_at)
  SELECT item_id, links, updated_at
  FROM public.game_links_backup_20261125_1940;

  UPDATE public.site_settings
  SET value = jsonb_set(
    COALESCE(value, '{}'::jsonb),
    '{protect}',
    'false'::jsonb,
    true
  )
  WHERE key = 'dl_verify';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'dl_verify setting missing; rollback stopped';
  END IF;

  RAISE NOTICE 'Rollback completed';
END
$undo$;

COMMIT;
