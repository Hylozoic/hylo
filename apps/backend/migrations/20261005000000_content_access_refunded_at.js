/**
 * Records refunds on content_access without changing access. A refund gives the money back;
 * the row keeps its status, and refunded_at / refunded_amount drive the Refunded badge and
 * filter. Both Hylo's Refund button and the Stripe charge.refunded webhook set them.
 *
 * Backfills rows that already carry a refund in their metadata (refundedAt from the Refund
 * button, refunded_at from the webhook).
 */

exports.up = async function up (knex) {
  await knex.schema.alterTable('content_access', table => {
    table.timestamp('refunded_at', { useTz: true }).nullable()
    table.integer('refunded_amount').nullable()
  })

  await knex.raw(`
    COMMENT ON COLUMN content_access.refunded_at IS 'When the most recent refund of this purchase was recorded; access is not changed by a refund';
    COMMENT ON COLUMN content_access.refunded_amount IS 'Amount of the most recent refund, in the smallest currency unit';
  `)

  await knex.raw(`
    UPDATE content_access
    SET
      refunded_at = COALESCE(
        CASE WHEN metadata->>'refunded_at' ~ '^\\d{4}-\\d{2}-\\d{2}' THEN (metadata->>'refunded_at')::timestamptz END,
        CASE WHEN metadata->>'refundedAt' ~ '^\\d{4}-\\d{2}-\\d{2}' THEN (metadata->>'refundedAt')::timestamptz END
      ),
      refunded_amount = COALESCE(
        CASE WHEN metadata->>'refund_amount' ~ '^\\d+$' THEN (metadata->>'refund_amount')::int END,
        CASE WHEN metadata->>'refundAmount' ~ '^\\d+$' THEN (metadata->>'refundAmount')::int END
      )
    WHERE refunded_at IS NULL
      AND (metadata->>'refunded_at' IS NOT NULL OR metadata->>'refundedAt' IS NOT NULL)
  `)
}

exports.down = async function down (knex) {
  await knex.schema.alterTable('content_access', table => {
    table.dropColumn('refunded_amount')
    table.dropColumn('refunded_at')
  })
}
