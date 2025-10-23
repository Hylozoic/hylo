exports.up = async function (knex) {
  // First, drop the existing foreign key from users to stripe_accounts
  await knex.schema.table('users', function (table) {
    table.dropForeign(['stripe_account_id'])
    table.dropColumn('stripe_account_id')
  })

  // Add Stripe columns to groups table
  await knex.schema.table('groups', function (table) {
    table.bigInteger('stripe_account_id').unsigned().references('id').inTable('stripe_accounts')
    table.boolean('stripe_charges_enabled').defaultTo(false)
    table.boolean('stripe_payouts_enabled').defaultTo(false)
    table.boolean('stripe_details_submitted').defaultTo(false)
  })

  // Create stripe_products table to track products associated with groups
  await knex.schema.createTable('stripe_products', function (table) {
    table.bigIncrements('id').primary()
    table.bigInteger('group_id').unsigned().notNullable().references('id').inTable('groups').onDelete('CASCADE')
    table.string('stripe_product_id', 255).notNullable()
    table.string('stripe_price_id', 255).notNullable()
    table.string('name', 255).notNullable()
    table.text('description')
    table.integer('price_in_cents').notNullable()
    table.string('currency', 3).notNullable().defaultTo('usd')
    table.boolean('active').defaultTo(true)
    table.bigInteger('track_id').unsigned().references('id').inTable('tracks')
    table.jsonb('content_access').defaultTo('{}').comment('Defines what access this product grants - groups, tracks, roles')
    table.string('renewal_policy', 20).defaultTo('manual').comment('Renewal policy: automatic or manual')
    table.string('duration', 20).comment('Duration: month, season, annual, lifetime, or null for no expiration')
    table.timestamps(true, true)

    table.index(['group_id'])
    table.index(['stripe_product_id'])
  })

  // Create content_access table to track all content access grants (paid and free)
  // This supports both Stripe purchases and admin-granted free access
  await knex.schema.createTable('content_access', function (table) {
    table.bigIncrements('id').primary()
    table.bigInteger('user_id').unsigned().notNullable().references('id').inTable('users')
    table.bigInteger('group_id').unsigned().notNullable().references('id').inTable('groups')
    table.bigInteger('product_id').unsigned().references('id').inTable('stripe_products')
    table.bigInteger('track_id').unsigned().references('id').inTable('tracks')
    table.integer('role_id').unsigned().references('id').inTable('groups_roles')

    // Access type: 'stripe_purchase', 'admin_grant', 'free'
    table.string('access_type', 50).notNullable()

    // Stripe-specific fields (nullable for non-Stripe grants)
    table.string('stripe_session_id', 255)
    table.string('stripe_payment_intent_id', 255)

    // Status: 'active', 'expired', 'revoked'
    table.string('status', 50).notNullable().defaultTo('active')

    // Who granted access (for admin grants)
    table.bigInteger('granted_by_id').unsigned().references('id').inTable('users')

    // Optional expiration
    table.timestamp('expires_at')

    // Flexible metadata for additional info
    table.jsonb('metadata').defaultTo('{}')

    table.timestamps(true, true)

    table.index(['user_id', 'status'])
    table.index(['group_id'])
    table.index(['product_id'])
    table.index(['track_id'])
    table.index(['role_id'])
    table.index(['stripe_session_id'])
    table.index(['access_type'])
    table.index(['status'])
  })

  // Add expires_at columns to related tables to mirror content_access expiration
  await knex.schema.table('group_memberships', function (table) {
    table.timestamp('expires_at').comment('Mirrored from content_access table via trigger')
  })

  await knex.schema.table('tracks_users', function (table) {
    table.timestamp('expires_at').comment('Mirrored from content_access table via trigger')
  })

  await knex.schema.table('group_memberships_group_roles', function (table) {
    table.timestamp('expires_at').comment('Mirrored from content_access table via trigger')
  })

  // Add access_controlled flag to tracks table
  // When true, this track requires purchased access (check content_access table)
  // When false (default), track is freely accessible to all group members
  await knex.schema.table('tracks', function (table) {
    table.boolean('access_controlled').defaultTo(false).comment('Whether this track requires purchased access')
  })

  // Add paywall flag to groups table
  // When true, this group requires purchased membership (check content_access table)
  // When false (default), group is freely joinable per existing access control rules
  await knex.schema.table('groups', function (table) {
    table.boolean('paywall').defaultTo(false).comment('Whether this group requires purchased membership')
  })

  // Create trigger function to sync expires_at to related tables
  // This function automatically updates the related tables whenever content_access is modified
  //
  // IMPORTANT: Multiple content_access records can reference the same stripe product
  // (e.g., a bundle purchase, recurring subscriptions, or multiple purchases over time)
  //
  // IMPORTANT: Uses the MOST RECENT expires_at from ALL active content_access records
  // This prevents old/expired records from overwriting newer access grants
  //
  // IMPORTANT: Only update group_memberships.expires_at when track_id is NULL
  // This prevents track purchases from overwriting the group membership expiration
  await knex.raw(`
    CREATE OR REPLACE FUNCTION sync_content_access_expires_at()
    RETURNS TRIGGER AS $$
    DECLARE
      latest_expires_at TIMESTAMP;
    BEGIN
      -- Update group_memberships if track_id is NULL (includes group-level and role-based purchases)
      -- Use the MOST RECENT expires_at from all active content_access records for this user+group
      IF NEW.track_id IS NULL THEN
        SELECT MAX(expires_at) INTO latest_expires_at
        FROM content_access
        WHERE user_id = NEW.user_id
          AND group_id = NEW.group_id
          AND track_id IS NULL
          AND status = 'active';

        UPDATE group_memberships
        SET expires_at = latest_expires_at,
            updated_at = NOW()
        WHERE user_id = NEW.user_id
          AND group_id = NEW.group_id;
      END IF;

      -- If track_id is set, update tracks_users with most recent expires_at for this track
      IF NEW.track_id IS NOT NULL THEN
        SELECT MAX(expires_at) INTO latest_expires_at
        FROM content_access
        WHERE user_id = NEW.user_id
          AND track_id = NEW.track_id
          AND status = 'active';

        UPDATE tracks_users
        SET expires_at = latest_expires_at,
            updated_at = NOW()
        WHERE user_id = NEW.user_id
          AND track_id = NEW.track_id;
      END IF;

      -- If role_id is set, update group_memberships_group_roles with most recent expires_at
      IF NEW.role_id IS NOT NULL THEN
        SELECT MAX(expires_at) INTO latest_expires_at
        FROM content_access
        WHERE user_id = NEW.user_id
          AND group_id = NEW.group_id
          AND group_role_id = NEW.role_id
          AND status = 'active';

        UPDATE group_memberships_group_roles
        SET expires_at = latest_expires_at
        WHERE user_id = NEW.user_id
          AND group_id = NEW.group_id
          AND group_role_id = NEW.role_id;
      END IF;

      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;
  `)

  // Create trigger on content_access for INSERT and UPDATE
  await knex.raw(`
    CREATE TRIGGER content_access_expires_at_sync
    AFTER INSERT OR UPDATE OF expires_at ON content_access
    FOR EACH ROW
    WHEN (NEW.status = 'active')
    EXECUTE FUNCTION sync_content_access_expires_at();
  `)

  // Create trigger function to clear expires_at when access is revoked
  // Uses the most recent expires_at from remaining active records, or clears if none
  await knex.raw(`
    CREATE OR REPLACE FUNCTION clear_content_access_expires_at()
    RETURNS TRIGGER AS $$
    DECLARE
      latest_expires_at TIMESTAMP;
    BEGIN
      -- Update group_memberships with most recent expires_at from OTHER active records
      -- If no other active records exist, this will set expires_at to NULL
      IF NEW.track_id IS NULL THEN
        SELECT MAX(expires_at) INTO latest_expires_at
        FROM content_access
        WHERE user_id = NEW.user_id
          AND group_id = NEW.group_id
          AND track_id IS NULL
          AND status = 'active'
          AND id != NEW.id;  -- Exclude the record being revoked

        UPDATE group_memberships
        SET expires_at = latest_expires_at,
            updated_at = NOW()
        WHERE user_id = NEW.user_id
          AND group_id = NEW.group_id;
      END IF;

      -- If track_id is set, update tracks_users with most recent from other active records
      IF NEW.track_id IS NOT NULL THEN
        SELECT MAX(expires_at) INTO latest_expires_at
        FROM content_access
        WHERE user_id = NEW.user_id
          AND track_id = NEW.track_id
          AND status = 'active'
          AND id != NEW.id;  -- Exclude the record being revoked

        UPDATE tracks_users
        SET expires_at = latest_expires_at,
            updated_at = NOW()
        WHERE user_id = NEW.user_id
          AND track_id = NEW.track_id;
      END IF;

      -- If role_id is set, update group_memberships_group_roles with most recent
      IF NEW.role_id IS NOT NULL THEN
        SELECT MAX(expires_at) INTO latest_expires_at
        FROM content_access
        WHERE user_id = NEW.user_id
          AND group_id = NEW.group_id
          AND group_role_id = NEW.role_id
          AND status = 'active'
          AND id != NEW.id;  -- Exclude the record being revoked

        UPDATE group_memberships_group_roles
        SET expires_at = latest_expires_at
        WHERE user_id = NEW.user_id
          AND group_id = NEW.group_id
          AND group_role_id = NEW.role_id;
      END IF;

      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;
  `)

  // Create trigger to clear expires_at when status changes to revoked/expired
  await knex.raw(`
    CREATE TRIGGER content_access_expires_at_clear
    AFTER UPDATE OF status ON content_access
    FOR EACH ROW
    WHEN (NEW.status IN ('revoked', 'expired'))
    EXECUTE FUNCTION clear_content_access_expires_at();
  `)
}

exports.down = async function (knex) {
  // Drop triggers first
  await knex.raw('DROP TRIGGER IF EXISTS content_access_expires_at_sync ON content_access')
  await knex.raw('DROP TRIGGER IF EXISTS content_access_expires_at_clear ON content_access')
  await knex.raw('DROP FUNCTION IF EXISTS sync_content_access_expires_at()')
  await knex.raw('DROP FUNCTION IF EXISTS clear_content_access_expires_at()')

  // Remove expires_at columns from related tables
  await knex.schema.table('group_memberships', function (table) {
    table.dropColumn('expires_at')
  })

  await knex.schema.table('tracks_users', function (table) {
    table.dropColumn('expires_at')
  })

  await knex.schema.table('group_memberships_group_roles', function (table) {
    table.dropColumn('expires_at')
  })

  // Remove access_controlled flag from tracks table
  await knex.schema.table('tracks', function (table) {
    table.dropColumn('access_controlled')
  })

  // Remove paywall flag from groups table
  await knex.schema.table('groups', function (table) {
    table.dropColumn('paywall')
  })

  // Drop the new tables
  await knex.schema.dropTableIfExists('content_access')
  await knex.schema.dropTableIfExists('stripe_products')

  // Remove Stripe columns from groups table
  await knex.schema.table('groups', function (table) {
    table.dropForeign(['stripe_account_id'])
    table.dropColumn('stripe_account_id')
    table.dropColumn('stripe_charges_enabled')
    table.dropColumn('stripe_payouts_enabled')
    table.dropColumn('stripe_details_submitted')
  })

  // Restore the stripe_account_id column to users table
  await knex.schema.table('users', function (table) {
    table.bigInteger('stripe_account_id').unsigned().references('id').inTable('stripe_accounts')
  })
}
