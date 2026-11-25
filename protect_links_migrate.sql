BEGIN;

DO $mig$
DECLARE
  r RECORD;
  d JSONB;
  m JSONB;
  f TEXT;
  i INT;
  j INT;
  vl JSONB;
  n INT := 0;
  settings_rows INT;
BEGIN
  IF to_regclass('public.game_links') IS NULL THEN
    RAISE EXCEPTION 'game_links table is missing';
  END IF;

  IF to_regclass('public.items_links_backup_20261125_1940') IS NOT NULL THEN
    RAISE EXCEPTION 'Backup table already exists; stop safely';
  END IF;

  CREATE TABLE public.items_links_backup_20261125_1940 AS
  SELECT id, data, now() AS backed_up_at
  FROM public.items;

  FOR r IN
    SELECT id, data FROM public.items ORDER BY id
  LOOP
    IF r.data IS NULL OR jsonb_typeof(r.data) <> 'object' THEN
      RAISE EXCEPTION 'Invalid items.data for item id %', r.id;
    END IF;

    d := r.data;
    m := '{}'::jsonb;

    FOREACH f IN ARRAY ARRAY[
      'u','up','tr','ad','ad2','sv','lc','dp'
    ]
    LOOP
      IF coalesce(d->>f, '') ~* '^https?://' THEN
        m := m || jsonb_build_object(f, d->>f);
        d := jsonb_set(d, ARRAY[f], '"@"'::jsonb);
      END IF;
    END LOOP;

    IF jsonb_typeof(d->'links') = 'array'
       AND jsonb_array_length(d->'links') > 0 THEN
      FOR i IN 0..jsonb_array_length(d->'links') - 1 LOOP
        IF coalesce(d->'links'->i->>'u', '') ~* '^https?://' THEN
          m := m || jsonb_build_object(
            'L' || i, d->'links'->i->>'u'
          );

          d := jsonb_set(
            d, ARRAY['links', i::text, 'u'], '"@"'::jsonb
          );
        END IF;
      END LOOP;
    END IF;

    IF jsonb_typeof(d->'versions') = 'array'
       AND jsonb_array_length(d->'versions') > 0 THEN
      FOR i IN 0..jsonb_array_length(d->'versions') - 1 LOOP
        vl := d->'versions'->i->'links';

        IF jsonb_typeof(vl) = 'array'
           AND jsonb_array_length(vl) > 0 THEN
          FOR j IN 0..jsonb_array_length(vl) - 1 LOOP
            IF coalesce(vl->j->>'u', '') ~* '^https?://' THEN
              m := m || jsonb_build_object(
                'V' || i || '_' || j, vl->j->>'u'
              );

              d := jsonb_set(
                d,
                ARRAY['versions', i::text, 'links', j::text, 'u'],
                '"@"'::jsonb
              );
            END IF;
          END LOOP;
        END IF;
      END LOOP;
    END IF;

    IF m <> '{}'::jsonb THEN
      INSERT INTO public.game_links(item_id, links, updated_at)
      VALUES (r.id, m, now())
      ON CONFLICT (item_id) DO UPDATE
      SET links = public.game_links.links || EXCLUDED.links,
          updated_at = now();

      UPDATE public.items
      SET data = d
      WHERE id = r.id;

      n := n + 1;
    END IF;
  END LOOP;

  IF n = 0 THEN
    RAISE EXCEPTION 'No download URLs found; migration stopped';
  END IF;

  UPDATE public.site_settings
  SET value = jsonb_set(
    COALESCE(value, '{}'::jsonb),
    '{protect}',
    'true'::jsonb,
    true
  )
  WHERE key = 'dl_verify';

  GET DIAGNOSTICS settings_rows = ROW_COUNT;

  IF settings_rows <> 1 THEN
    RAISE EXCEPTION 'dl_verify setting missing; migration stopped';
  END IF;

  RAISE NOTICE 'Protected items: %', n;
END
$mig$;

COMMIT;
