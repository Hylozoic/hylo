exports.up = async function (knex) {
  // Create user_scopes table to materialize user entitlements
  await knex.schema.createTable('user_scopes', table => {
    table.bigInteger('user_id').references('id').inTable('users').notNullable()
    table.string('scope').notNullable()
    table.timestamp('expires_at').nullable().comment('Earliest ends_at among sources; null means never expires')
    table.string('source_kind').notNullable().comment('Type of source: grant or role')
    table.bigInteger('source_id').notNullable().comment('ID of the content_access grant or group_memberships_group_roles record')
    table.timestamp('created_at')
    table.timestamp('updated_at')

    // Composite primary key on (user_id, scope)
    table.primary(['user_id', 'scope'])
  })

  // Create index for fast lookups by user and scope
  await knex.raw('CREATE INDEX user_scopes_user_id_scope_index ON user_scopes (user_id, scope)')

  // Create index for expires_at to find expiring scopes
  await knex.raw('CREATE INDEX user_scopes_expires_at_index ON user_scopes (expires_at) WHERE expires_at IS NOT NULL')

  // Create index for source lookups
  await knex.raw('CREATE INDEX user_scopes_source_index ON user_scopes (source_kind, source_id)')

  // Add scopes column to groups_roles table
  await knex.schema.table('groups_roles', table => {
    table.jsonb('scopes').nullable().comment('Array of scope strings that this role grants')
  })

  // Rename content_access column to access_grants on stripe_products for clarity
  // (content_access is the table name, access_grants is what the offering will grant)
  await knex.schema.table('stripe_products', table => {
    table.renameColumn('content_access', 'access_grants')
  })

  // Remove old expires_at columns that were mirrored from content_access
  await knex.schema.table('group_memberships', table => {
    table.dropColumn('expires_at')
  })

  await knex.schema.table('tracks_users', table => {
    table.dropColumn('access_granted')
  })

  await knex.schema.table('group_memberships_group_roles', table => {
    table.dropColumn('expires_at')
  })

  // Remove old database triggers that updated expires_at
  await knex.raw('DROP TRIGGER IF EXISTS content_access_expires_at_sync ON content_access')
  await knex.raw('DROP TRIGGER IF EXISTS content_access_expires_at_clear ON content_access')
  await knex.raw('DROP FUNCTION IF EXISTS sync_content_access_expires_at()')
  await knex.raw('DROP FUNCTION IF EXISTS clear_content_access_expires_at()')

  // Create new database function to compute user_scopes from content_access
  await knex.raw(`
    CREATE OR REPLACE FUNCTION compute_user_scopes_from_content_access()
    RETURNS TRIGGER AS $$
    DECLARE
      scope_string TEXT;
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
        
        -- Role access: scope format is 'group_role:<role_id>'
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
        
        -- Group access: scope format is 'group:<group_id>'
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
        -- If status is not active (revoked/expired), remove the scope
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

  // Create new database function to compute user_scopes from role assignments
  await knex.raw(`
    CREATE OR REPLACE FUNCTION compute_user_scopes_from_role()
    RETURNS TRIGGER AS $$
    DECLARE
      role_scopes JSONB;
      scope_string TEXT;
    BEGIN
      -- Only process active role assignments
      IF NEW.active = true THEN
        -- Fetch the scopes array from the groups_roles table
        SELECT scopes INTO role_scopes
        FROM groups_roles
        WHERE id = NEW.group_role_id;
        
        -- If the role has scopes defined, insert them into user_scopes
        IF role_scopes IS NOT NULL THEN
          -- Iterate over each scope in the JSONB array
          FOR scope_string IN SELECT jsonb_array_elements_text(role_scopes)
          LOOP
            INSERT INTO user_scopes (user_id, scope, expires_at, source_kind, source_id, created_at, updated_at)
            VALUES (NEW.user_id, scope_string, NULL, 'role', NEW.id, NOW(), NOW())
            ON CONFLICT (user_id, scope) 
            DO UPDATE SET 
              updated_at = NOW();
          END LOOP;
        END IF;
      ELSE
        -- If role assignment is not active, remove the scopes
        -- We need to get the scopes from the role again to know what to delete
        SELECT scopes INTO role_scopes
        FROM groups_roles
        WHERE id = NEW.group_role_id;
        
        IF role_scopes IS NOT NULL THEN
          FOR scope_string IN SELECT jsonb_array_elements_text(role_scopes)
          LOOP
            DELETE FROM user_scopes 
            WHERE user_id = NEW.user_id 
              AND scope = scope_string 
              AND source_kind = 'role' 
              AND source_id = NEW.id;
          END LOOP;
        END IF;
      END IF;
      
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;
  `)

  // Create triggers on content_access table to update user_scopes
  await knex.raw(`
    CREATE TRIGGER content_access_user_scopes_sync
    AFTER INSERT OR UPDATE ON content_access
    FOR EACH ROW
    EXECUTE FUNCTION compute_user_scopes_from_content_access();
  `)

  await knex.raw(`
    CREATE TRIGGER content_access_user_scopes_delete
    AFTER DELETE ON content_access
    FOR EACH ROW
    EXECUTE FUNCTION compute_user_scopes_from_content_access();
  `)

  // Create triggers on group_memberships_group_roles table to update user_scopes
  await knex.raw(`
    CREATE TRIGGER group_role_assignment_user_scopes_sync
    AFTER INSERT OR UPDATE ON group_memberships_group_roles
    FOR EACH ROW
    EXECUTE FUNCTION compute_user_scopes_from_role();
  `)

  await knex.raw(`
    CREATE TRIGGER group_role_assignment_user_scopes_delete
    AFTER DELETE ON group_memberships_group_roles
    FOR EACH ROW
    EXECUTE FUNCTION compute_user_scopes_from_role();
  `)
}

exports.down = async function (knex) {
  // Drop new triggers
  await knex.raw('DROP TRIGGER IF EXISTS group_role_assignment_user_scopes_delete ON group_memberships_group_roles')
  await knex.raw('DROP TRIGGER IF EXISTS group_role_assignment_user_scopes_sync ON group_memberships_group_roles')
  await knex.raw('DROP TRIGGER IF EXISTS content_access_user_scopes_delete ON content_access')
  await knex.raw('DROP TRIGGER IF EXISTS content_access_user_scopes_sync ON content_access')

  // Drop new functions
  await knex.raw('DROP FUNCTION IF EXISTS compute_user_scopes_from_role()')
  await knex.raw('DROP FUNCTION IF EXISTS compute_user_scopes_from_content_access()')

  // Restore old column name
  await knex.schema.table('stripe_products', table => {
    table.renameColumn('access_grants', 'content_access')
  })

  // Restore old expires_at columns
  await knex.schema.table('group_memberships_group_roles', table => {
    table.timestamp('expires_at').comment('Mirrored from content_access table via trigger')
  })

  await knex.schema.table('tracks_users', table => {
    table.boolean('access_granted').comment('Whether user has access to track (set via trigger)')
  })

  await knex.schema.table('group_memberships', table => {
    table.timestamp('expires_at').comment('Mirrored from content_access table via trigger')
  })

  // Remove scopes column from groups_roles
  await knex.schema.table('groups_roles', table => {
    table.dropColumn('scopes')
  })

  // Drop user_scopes table
  await knex.schema.dropTableIfExists('user_scopes')
}
