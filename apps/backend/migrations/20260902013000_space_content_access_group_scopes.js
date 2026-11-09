/**
 * Paid-space purchases store the space on content_access.group_id and the
 * selling group on granted_by_group_id. The user_scopes trigger was writing
 * group:<granted_by_group_id>, so All Activity still saw canAccess=false.
 * Scope the grant to the group/space actually purchased.
 */
exports.up = async function (knex) {
  await knex.raw(`
    CREATE OR REPLACE FUNCTION compute_user_scopes_from_content_access()
    RETURNS TRIGGER AS $$
    DECLARE
      scope_string TEXT;
      scope_group_id BIGINT;
    BEGIN
      IF NEW.status = 'active' THEN
        IF NEW.track_id IS NOT NULL THEN
          scope_string := 'track:' || NEW.track_id;
          INSERT INTO user_scopes (user_id, scope, expires_at, source_kind, source_id, created_at, updated_at)
          VALUES (NEW.user_id, scope_string, NEW.expires_at, 'grant', NEW.id, NOW(), NOW())
          ON CONFLICT (user_id, scope)
          DO UPDATE SET
            expires_at = CASE
              WHEN user_scopes.expires_at IS NULL OR NEW.expires_at IS NULL THEN NULL
              WHEN NEW.expires_at > user_scopes.expires_at THEN NEW.expires_at
              ELSE user_scopes.expires_at
            END,
            updated_at = NOW();
        END IF;

        IF NEW.group_role_id IS NOT NULL THEN
          scope_group_id := COALESCE(NEW.group_id, NEW.granted_by_group_id);
          IF scope_group_id IS NULL THEN
            RAISE WARNING 'Cannot create group role scope: missing group_id and granted_by_group_id for content_access %', NEW.id;
          ELSE
            scope_string := 'group_role:' || scope_group_id || ':' || NEW.group_role_id;
            INSERT INTO user_scopes (user_id, scope, expires_at, source_kind, source_id, created_at, updated_at)
            VALUES (NEW.user_id, scope_string, NEW.expires_at, 'grant', NEW.id, NOW(), NOW())
            ON CONFLICT (user_id, scope)
            DO UPDATE SET
              expires_at = CASE
                WHEN user_scopes.expires_at IS NULL OR NEW.expires_at IS NULL THEN NULL
                WHEN NEW.expires_at > user_scopes.expires_at THEN NEW.expires_at
                ELSE user_scopes.expires_at
              END,
              updated_at = NOW();
          END IF;
        END IF;

        IF NEW.track_id IS NULL AND NEW.group_role_id IS NULL THEN
          scope_group_id := COALESCE(NEW.group_id, NEW.granted_by_group_id);
          IF scope_group_id IS NOT NULL THEN
            scope_string := 'group:' || scope_group_id;
            INSERT INTO user_scopes (user_id, scope, expires_at, source_kind, source_id, created_at, updated_at)
            VALUES (NEW.user_id, scope_string, NEW.expires_at, 'grant', NEW.id, NOW(), NOW())
            ON CONFLICT (user_id, scope)
            DO UPDATE SET
              expires_at = CASE
                WHEN user_scopes.expires_at IS NULL OR NEW.expires_at IS NULL THEN NULL
                WHEN NEW.expires_at > user_scopes.expires_at THEN NEW.expires_at
                ELSE user_scopes.expires_at
              END,
              updated_at = NOW();
          END IF;
        END IF;
      ELSE
        IF NEW.track_id IS NOT NULL THEN
          scope_string := 'track:' || NEW.track_id;
          DELETE FROM user_scopes
          WHERE user_id = NEW.user_id AND scope = scope_string AND source_kind = 'grant' AND source_id = NEW.id;
        END IF;

        IF NEW.group_role_id IS NOT NULL THEN
          scope_group_id := COALESCE(NEW.group_id, NEW.granted_by_group_id);
          IF scope_group_id IS NOT NULL THEN
            scope_string := 'group_role:' || scope_group_id || ':' || NEW.group_role_id;
            DELETE FROM user_scopes
            WHERE user_id = NEW.user_id AND scope = scope_string AND source_kind = 'grant' AND source_id = NEW.id;
          END IF;
        END IF;

        IF NEW.track_id IS NULL AND NEW.group_role_id IS NULL THEN
          scope_group_id := COALESCE(NEW.group_id, NEW.granted_by_group_id);
          IF scope_group_id IS NOT NULL THEN
            scope_string := 'group:' || scope_group_id;
            DELETE FROM user_scopes
            WHERE user_id = NEW.user_id AND scope = scope_string AND source_kind = 'grant' AND source_id = NEW.id;
          END IF;
        END IF;
      END IF;

      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;
  `)

  await knex.raw(`
    INSERT INTO user_scopes (user_id, scope, expires_at, source_kind, source_id, created_at, updated_at)
    SELECT
      ca.user_id,
      'group:' || ca.group_id,
      ca.expires_at,
      'grant',
      ca.id,
      NOW(),
      NOW()
    FROM content_access ca
    WHERE ca.status = 'active'
      AND ca.track_id IS NULL
      AND ca.group_role_id IS NULL
      AND ca.group_id IS NOT NULL
    ON CONFLICT (user_id, scope)
    DO UPDATE SET
      expires_at = CASE
        WHEN user_scopes.expires_at IS NULL OR EXCLUDED.expires_at IS NULL THEN NULL
        WHEN EXCLUDED.expires_at > user_scopes.expires_at THEN EXCLUDED.expires_at
        ELSE user_scopes.expires_at
      END,
      updated_at = NOW()
  `)
}

exports.down = async function (knex) {
  await knex.raw(`
    CREATE OR REPLACE FUNCTION compute_user_scopes_from_content_access()
    RETURNS TRIGGER AS $$
    DECLARE
      scope_string TEXT;
      scope_group_id BIGINT;
    BEGIN
      IF NEW.status = 'active' THEN
        IF NEW.track_id IS NOT NULL THEN
          scope_string := 'track:' || NEW.track_id;
          INSERT INTO user_scopes (user_id, scope, expires_at, source_kind, source_id, created_at, updated_at)
          VALUES (NEW.user_id, scope_string, NEW.expires_at, 'grant', NEW.id, NOW(), NOW())
          ON CONFLICT (user_id, scope)
          DO UPDATE SET
            expires_at = CASE
              WHEN user_scopes.expires_at IS NULL OR NEW.expires_at IS NULL THEN NULL
              WHEN NEW.expires_at > user_scopes.expires_at THEN NEW.expires_at
              ELSE user_scopes.expires_at
            END,
            updated_at = NOW();
        END IF;

        IF NEW.group_role_id IS NOT NULL THEN
          scope_group_id := COALESCE(NEW.group_id, NEW.granted_by_group_id);
          IF scope_group_id IS NULL THEN
            RAISE WARNING 'Cannot create group role scope: missing group_id and granted_by_group_id for content_access %', NEW.id;
          ELSE
            scope_string := 'group_role:' || scope_group_id || ':' || NEW.group_role_id;
            INSERT INTO user_scopes (user_id, scope, expires_at, source_kind, source_id, created_at, updated_at)
            VALUES (NEW.user_id, scope_string, NEW.expires_at, 'grant', NEW.id, NOW(), NOW())
            ON CONFLICT (user_id, scope)
            DO UPDATE SET
              expires_at = CASE
                WHEN user_scopes.expires_at IS NULL OR NEW.expires_at IS NULL THEN NULL
                WHEN NEW.expires_at > user_scopes.expires_at THEN NEW.expires_at
                ELSE user_scopes.expires_at
              END,
              updated_at = NOW();
          END IF;
        END IF;

        IF NEW.track_id IS NULL AND NEW.group_role_id IS NULL AND NEW.granted_by_group_id IS NOT NULL THEN
          scope_string := 'group:' || NEW.granted_by_group_id;
          INSERT INTO user_scopes (user_id, scope, expires_at, source_kind, source_id, created_at, updated_at)
          VALUES (NEW.user_id, scope_string, NEW.expires_at, 'grant', NEW.id, NOW(), NOW())
          ON CONFLICT (user_id, scope)
          DO UPDATE SET
            expires_at = CASE
              WHEN user_scopes.expires_at IS NULL OR NEW.expires_at IS NULL THEN NULL
              WHEN NEW.expires_at > user_scopes.expires_at THEN NEW.expires_at
              ELSE user_scopes.expires_at
            END,
            updated_at = NOW();
        END IF;
      ELSE
        IF NEW.track_id IS NOT NULL THEN
          scope_string := 'track:' || NEW.track_id;
          DELETE FROM user_scopes
          WHERE user_id = NEW.user_id AND scope = scope_string AND source_kind = 'grant' AND source_id = NEW.id;
        END IF;

        IF NEW.group_role_id IS NOT NULL THEN
          scope_group_id := COALESCE(NEW.group_id, NEW.granted_by_group_id);
          IF scope_group_id IS NOT NULL THEN
            scope_string := 'group_role:' || scope_group_id || ':' || NEW.group_role_id;
            DELETE FROM user_scopes
            WHERE user_id = NEW.user_id AND scope = scope_string AND source_kind = 'grant' AND source_id = NEW.id;
          END IF;
        END IF;

        IF NEW.track_id IS NULL AND NEW.group_role_id IS NULL AND NEW.granted_by_group_id IS NOT NULL THEN
          scope_string := 'group:' || NEW.granted_by_group_id;
          DELETE FROM user_scopes
          WHERE user_id = NEW.user_id AND scope = scope_string AND source_kind = 'grant' AND source_id = NEW.id;
        END IF;
      END IF;

      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;
  `)
}
