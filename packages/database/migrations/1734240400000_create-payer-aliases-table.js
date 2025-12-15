/* eslint-disable camelcase */

/**
 * PAYER_ALIASES TABLE
 *
 * Purpose: Maps different name variations to canonical payer names for consistent matching.
 *
 * Key Fields:
 * - canonical_name: The standardized payer name (e.g., "Medicare Australia")
 * - alias_name: A variation that appears in data (e.g., "MEDICARE", "Medicare", "Med Aus")
 *
 * Business Rules:
 * - Enables fuzzy name matching by normalizing payer variations
 * - One canonical name can have multiple aliases
 * - Unique constraint prevents duplicate canonical-alias pairs
 * - Critical for matching when payer names vary across data sources
 *
 * Example Usage:
 * - Canonical: "Medicare Australia"
 *   Aliases: "MEDICARE", "Medicare", "Med Aus", "Medicare Aus"
 * - Canonical: "Medibank Private"
 *   Aliases: "MEDIBANK", "Medibank", "MBK"
 */

exports.shorthands = undefined;

exports.up = (pgm) => {
  // Create payer_aliases table
  pgm.createTable('payer_aliases', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()'),
    },
    canonical_name: {
      type: 'varchar(255)',
      notNull: true,
      comment: 'Standardized payer name',
    },
    alias_name: {
      type: 'varchar(255)',
      notNull: true,
      comment: 'Name variation that appears in data sources',
    },
    created_at: {
      type: 'timestamp',
      notNull: true,
      default: pgm.func('CURRENT_TIMESTAMP'),
    },
  });

  // Add table comment
  pgm.sql(`
    COMMENT ON TABLE payer_aliases IS 'Maps payer name variations to canonical names for consistent matching';
  `);

  // Create unique constraint on canonical_name + alias_name combination
  pgm.addConstraint('payer_aliases', 'unique_canonical_alias_pair', {
    unique: ['canonical_name', 'alias_name'],
  });

  // Create index on canonical_name for lookups
  pgm.createIndex('payer_aliases', 'canonical_name', {
    name: 'idx_payer_aliases_canonical_name',
  });

  // Create index on alias_name for reverse lookups (finding canonical from alias)
  pgm.createIndex('payer_aliases', 'alias_name', {
    name: 'idx_payer_aliases_alias_name',
  });

  // Create case-insensitive index for alias_name (for fuzzy matching)
  pgm.sql(`
    CREATE INDEX idx_payer_aliases_alias_name_lower
    ON payer_aliases (LOWER(alias_name));
  `);
};

exports.down = (pgm) => {
  pgm.dropTable('payer_aliases', { ifExists: true, cascade: true });
};
