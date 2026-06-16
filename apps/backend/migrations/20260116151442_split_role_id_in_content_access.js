exports.up = async function (knex) {
  // Add new columns for common_role_id and group_role_id
  await knex.schema.table('content_access', table => {
    table.integer('common_role_id').unsigned().references('id').inTable('common_roles').nullable()
    table.integer('group_role_id').unsigned().references('id').inTable('groups_roles').nullable()
  })

  // Migrate existing role_id data to group_role_id
  // Since role_id currently references groups_roles, all existing data should go to group_role_id
  await knex.raw(`
    UPDATE content_access
    SET group_role_id = role_id
    WHERE role_id IS NOT NULL
  `)

  // Add indexes for the new columns
  await knex.schema.table('content_access', table => {
    table.index(['common_role_id'])
    table.index(['group_role_id'])
  })

  // Drop the old role_id column and its index
  await knex.schema.table('content_access', table => {
    table.dropIndex(['role_id'])
    table.dropForeign(['role_id'])
    table.dropColumn('role_id')
  })

  // Update the existing database trigger function to handle both common_role_id and group_role_id
  // This function was created in migration 20251110143609_extend-content-access-to-scopes.js
  // and is called by triggers on content_access table, so we must update it to reference
  // the new columns instead of the old role_id column
  await knex.raw(`
    CREATE OR REPLACE FUNCTION compute_user_scopes_from_content_access()
    RETURNS TRIGGER AS $$
    DECLARE
      scope_string TEXT;
      scope_group_id BIGINT;
    BEGIN
      -- Only process active content_access records
      IF NEW.status = 'active' THEN
        -- Determine the scope based on what the content_access grants
        
        -- Track access: scope format is 'track:<track_id>'
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
        
        -- Group role access: scope format is 'group_role:<group_id>:<role_id>'
        IF NEW.group_role_id IS NOT NULL THEN
          -- Use group_id if available, otherwise fall back to granted_by_group_id
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

        -- Common role access: scope format is 'common_role:<group_id>:<role_id>'
        IF NEW.common_role_id IS NOT NULL THEN
          -- Use group_id if available, otherwise fall back to granted_by_group_id
          scope_group_id := COALESCE(NEW.group_id, NEW.granted_by_group_id);
          IF scope_group_id IS NULL THEN
            RAISE WARNING 'Cannot create common role scope: missing group_id and granted_by_group_id for content_access %', NEW.id;
          ELSE
            scope_string := 'common_role:' || scope_group_id || ':' || NEW.common_role_id;

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
        
        -- Group access: scope format is 'group:<group_id>'
        IF NEW.track_id IS NULL AND NEW.group_role_id IS NULL AND NEW.common_role_id IS NULL AND NEW.granted_by_group_id IS NOT NULL THEN
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
        -- If status is not active (revoked/expired), remove the scope
        IF NEW.track_id IS NOT NULL THEN
          scope_string := 'track:' || NEW.track_id;
          DELETE FROM user_scopes 
          WHERE user_id = NEW.user_id 
            AND scope = scope_string 
            AND source_kind = 'grant' 
            AND source_id = NEW.id;
        END IF;
        
        IF NEW.group_role_id IS NOT NULL THEN
          scope_group_id := COALESCE(NEW.group_id, NEW.granted_by_group_id);
          IF scope_group_id IS NOT NULL THEN
            scope_string := 'group_role:' || scope_group_id || ':' || NEW.group_role_id;
            DELETE FROM user_scopes 
            WHERE user_id = NEW.user_id 
              AND scope = scope_string 
              AND source_kind = 'grant' 
              AND source_id = NEW.id;
          END IF;
        END IF;

        IF NEW.common_role_id IS NOT NULL THEN
          scope_group_id := COALESCE(NEW.group_id, NEW.granted_by_group_id);
          IF scope_group_id IS NOT NULL THEN
            scope_string := 'common_role:' || scope_group_id || ':' || NEW.common_role_id;
            DELETE FROM user_scopes 
            WHERE user_id = NEW.user_id 
              AND scope = scope_string 
              AND source_kind = 'grant' 
              AND source_id = NEW.id;
          END IF;
        END IF;
        
        IF NEW.track_id IS NULL AND NEW.group_role_id IS NULL AND NEW.common_role_id IS NULL AND NEW.granted_by_group_id IS NOT NULL THEN
          scope_string := 'group:' || NEW.granted_by_group_id;
          DELETE FROM user_scopes 
          WHERE user_id = NEW.user_id 
            AND scope = scope_string 
            AND source_kind = 'grant' 
            AND source_id = NEW.id;
        END IF;
      END IF;
      
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;
  `)

  // Update the sync_content_access_expires_at function to handle both role types
  await knex.raw(`
    CREATE OR REPLACE FUNCTION sync_content_access_expires_at()
    RETURNS TRIGGER AS $$
    DECLARE
      latest_expires_at TIMESTAMP WITH TIME ZONE;
    BEGIN
      -- Track-level access: sync to tracks_users
      IF NEW.track_id IS NOT NULL THEN
        UPDATE tracks_users
        SET access_granted = true, updated_at = NOW()
        WHERE user_id = NEW.user_id AND track_id = NEW.track_id;
      END IF;

      -- Group role-level access: sync to group_memberships_group_roles and group_memberships
      IF NEW.group_role_id IS NOT NULL THEN
        SELECT MAX(expires_at) INTO latest_expires_at 
        FROM content_access 
        WHERE user_id = NEW.user_id 
          AND group_role_id = NEW.group_role_id 
          AND granted_by_group_id = NEW.granted_by_group_id 
          AND status = 'active';
        UPDATE group_memberships_group_roles 
        SET expires_at = latest_expires_at, updated_at = NOW() 
        WHERE user_id = NEW.user_id 
          AND group_id = NEW.granted_by_group_id 
          AND group_role_id = NEW.group_role_id;
        UPDATE group_memberships 
        SET expires_at = latest_expires_at, updated_at = NOW() 
        WHERE user_id = NEW.user_id 
          AND group_id = NEW.granted_by_group_id;
      END IF;

      -- Common role-level access: sync to group_memberships_common_roles and group_memberships
      IF NEW.common_role_id IS NOT NULL THEN
        SELECT MAX(expires_at) INTO latest_expires_at 
        FROM content_access 
        WHERE user_id = NEW.user_id 
          AND common_role_id = NEW.common_role_id 
          AND granted_by_group_id = NEW.granted_by_group_id 
          AND status = 'active';
        -- Note: We don't update group_memberships_common_roles expires_at directly
        -- as it's managed separately, but we update group_memberships
        UPDATE group_memberships 
        SET expires_at = latest_expires_at, updated_at = NOW() 
        WHERE user_id = NEW.user_id 
          AND group_id = NEW.granted_by_group_id;
      END IF;

      -- Group-level access: sync to group_memberships
      IF NEW.track_id IS NULL AND NEW.group_role_id IS NULL AND NEW.common_role_id IS NULL THEN
        SELECT MAX(expires_at) INTO latest_expires_at 
        FROM content_access 
        WHERE user_id = NEW.user_id 
          AND granted_by_group_id = NEW.granted_by_group_id 
          AND track_id IS NULL 
          AND group_role_id IS NULL 
          AND common_role_id IS NULL 
          AND status = 'active';
        UPDATE group_memberships 
        SET expires_at = latest_expires_at, updated_at = NOW() 
        WHERE user_id = NEW.user_id 
          AND group_id = NEW.granted_by_group_id;
      END IF;

      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;
  `)

  // Update the clear_content_access_expires_at function
  await knex.raw(`
    CREATE OR REPLACE FUNCTION clear_content_access_expires_at()
    RETURNS TRIGGER AS $$
    DECLARE
      latest_expires_at TIMESTAMP WITH TIME ZONE;
    BEGIN
      -- Track-level access: clear from tracks_users
      IF NEW.track_id IS NOT NULL THEN
        UPDATE tracks_users
        SET access_granted = false, updated_at = NOW()
        WHERE user_id = NEW.user_id AND track_id = NEW.track_id;
      END IF;

      -- Group role-level access: clear from group_memberships_group_roles and group_memberships
      IF NEW.group_role_id IS NOT NULL THEN
        SELECT MAX(expires_at) INTO latest_expires_at 
        FROM content_access 
        WHERE user_id = NEW.user_id 
          AND group_role_id = NEW.group_role_id 
          AND granted_by_group_id = NEW.granted_by_group_id 
          AND status = 'active' 
          AND id != NEW.id;
        UPDATE group_memberships_group_roles 
        SET expires_at = latest_expires_at, updated_at = NOW() 
        WHERE user_id = NEW.user_id 
          AND group_id = NEW.granted_by_group_id 
          AND group_role_id = NEW.group_role_id;
        UPDATE group_memberships 
        SET expires_at = latest_expires_at, updated_at = NOW() 
        WHERE user_id = NEW.user_id 
          AND group_id = NEW.granted_by_group_id;
      END IF;

      -- Common role-level access: clear from group_memberships
      IF NEW.common_role_id IS NOT NULL THEN
        SELECT MAX(expires_at) INTO latest_expires_at 
        FROM content_access 
        WHERE user_id = NEW.user_id 
          AND common_role_id = NEW.common_role_id 
          AND granted_by_group_id = NEW.granted_by_group_id 
          AND status = 'active' 
          AND id != NEW.id;
        UPDATE group_memberships 
        SET expires_at = latest_expires_at, updated_at = NOW() 
        WHERE user_id = NEW.user_id 
          AND group_id = NEW.granted_by_group_id;
      END IF;

      -- Group-level access: clear from group_memberships
      IF NEW.track_id IS NULL AND NEW.group_role_id IS NULL AND NEW.common_role_id IS NULL THEN
        SELECT MAX(expires_at) INTO latest_expires_at 
        FROM content_access 
        WHERE user_id = NEW.user_id 
          AND granted_by_group_id = NEW.granted_by_group_id 
          AND track_id IS NULL 
          AND group_role_id IS NULL 
          AND common_role_id IS NULL 
          AND status = 'active' 
          AND id != NEW.id;
        UPDATE group_memberships 
        SET expires_at = latest_expires_at, updated_at = NOW() 
        WHERE user_id = NEW.user_id 
          AND group_id = NEW.granted_by_group_id;
      END IF;

      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;
  `)
}

exports.down = async function (knex) {
  // Restore the old role_id column
  await knex.schema.table('content_access', table => {
    table.integer('role_id').unsigned().references('id').inTable('groups_roles').nullable()
  })

  // Migrate group_role_id back to role_id
  await knex.raw(`
    UPDATE content_access
    SET role_id = group_role_id
    WHERE group_role_id IS NOT NULL
  `)

  // Add index for role_id
  await knex.schema.table('content_access', table => {
    table.index(['role_id'])
  })

  // Drop the new columns and their indexes
  await knex.schema.table('content_access', table => {
    table.dropIndex(['common_role_id'])
    table.dropIndex(['group_role_id'])
    table.dropForeign(['common_role_id'])
    table.dropForeign(['group_role_id'])
    table.dropColumn('common_role_id')
    table.dropColumn('group_role_id')
  })

  // Restore the old trigger functions (reverting to role_id only)
  await knex.raw(`
    CREATE OR REPLACE FUNCTION compute_user_scopes_from_content_access()
    RETURNS TRIGGER AS $$
    DECLARE
      scope_string TEXT;
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
        
        IF NEW.role_id IS NOT NULL THEN
          scope_string := 'group_role:' || NEW.role_id;
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
        
        IF NEW.track_id IS NULL AND NEW.role_id IS NULL AND NEW.granted_by_group_id IS NOT NULL THEN
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
          WHERE user_id = NEW.user_id 
            AND scope = scope_string 
            AND source_kind = 'grant' 
            AND source_id = NEW.id;
        END IF;
        
        IF NEW.role_id IS NOT NULL THEN
          scope_string := 'group_role:' || NEW.role_id;
          DELETE FROM user_scopes 
          WHERE user_id = NEW.user_id 
            AND scope = scope_string 
            AND source_kind = 'grant' 
            AND source_id = NEW.id;
        END IF;
        
        IF NEW.track_id IS NULL AND NEW.role_id IS NULL AND NEW.granted_by_group_id IS NOT NULL THEN
          scope_string := 'group:' || NEW.granted_by_group_id;
          DELETE FROM user_scopes 
          WHERE user_id = NEW.user_id 
            AND scope = scope_string 
            AND source_kind = 'grant' 
            AND source_id = NEW.id;
        END IF;
      END IF;
      
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;
  `)

  await knex.raw(`
    CREATE OR REPLACE FUNCTION sync_content_access_expires_at()
    RETURNS TRIGGER AS $$
    DECLARE
      latest_expires_at TIMESTAMP WITH TIME ZONE;
    BEGIN
      IF NEW.track_id IS NOT NULL THEN
        UPDATE tracks_users
        SET access_granted = true, updated_at = NOW()
        WHERE user_id = NEW.user_id AND track_id = NEW.track_id;
      END IF;

      IF NEW.role_id IS NOT NULL THEN
        SELECT MAX(expires_at) INTO latest_expires_at FROM content_access WHERE user_id = NEW.user_id AND role_id = NEW.role_id AND granted_by_group_id = NEW.granted_by_group_id AND status = 'active';
        UPDATE group_memberships_group_roles SET expires_at = latest_expires_at, updated_at = NOW() WHERE user_id = NEW.user_id AND group_id = NEW.granted_by_group_id AND group_role_id = NEW.role_id;
        UPDATE group_memberships SET expires_at = latest_expires_at, updated_at = NOW() WHERE user_id = NEW.user_id AND group_id = NEW.granted_by_group_id;
      END IF;

      IF NEW.track_id IS NULL AND NEW.role_id IS NULL THEN
        SELECT MAX(expires_at) INTO latest_expires_at FROM content_access WHERE user_id = NEW.user_id AND granted_by_group_id = NEW.granted_by_group_id AND track_id IS NULL AND role_id IS NULL AND status = 'active';
        UPDATE group_memberships SET expires_at = latest_expires_at, updated_at = NOW() WHERE user_id = NEW.user_id AND group_id = NEW.granted_by_group_id;
      END IF;

      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;
  `)

  await knex.raw(`
    CREATE OR REPLACE FUNCTION clear_content_access_expires_at()
    RETURNS TRIGGER AS $$
    DECLARE
      latest_expires_at TIMESTAMP WITH TIME ZONE;
    BEGIN
      IF NEW.track_id IS NOT NULL THEN
        UPDATE tracks_users
        SET access_granted = false, updated_at = NOW()
        WHERE user_id = NEW.user_id AND track_id = NEW.track_id;
      END IF;

      IF NEW.role_id IS NOT NULL THEN
        SELECT MAX(expires_at) INTO latest_expires_at FROM content_access WHERE user_id = NEW.user_id AND role_id = NEW.role_id AND granted_by_group_id = NEW.granted_by_group_id AND status = 'active' AND id != NEW.id;
        UPDATE group_memberships_group_roles SET expires_at = latest_expires_at, updated_at = NOW() WHERE user_id = NEW.user_id AND group_id = NEW.granted_by_group_id AND group_role_id = NEW.role_id;
        UPDATE group_memberships SET expires_at = latest_expires_at, updated_at = NOW() WHERE user_id = NEW.user_id AND group_id = NEW.granted_by_group_id;
      END IF;

      IF NEW.track_id IS NULL AND NEW.role_id IS NULL THEN
        SELECT MAX(expires_at) INTO latest_expires_at FROM content_access WHERE user_id = NEW.user_id AND granted_by_group_id = NEW.granted_by_group_id AND track_id IS NULL AND role_id IS NULL AND status = 'active' AND id != NEW.id;
        UPDATE group_memberships SET expires_at = latest_expires_at, updated_at = NOW() WHERE user_id = NEW.user_id AND group_id = NEW.granted_by_group_id;
      END IF;

      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;
  `)
}
