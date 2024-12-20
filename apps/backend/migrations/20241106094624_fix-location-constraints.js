exports.up = function(knex) {
  return knex.raw(`
    ALTER TABLE public.posts 
      DROP CONSTRAINT posts_location_id_foreign,
      ADD CONSTRAINT posts_location_id_foreign 
        FOREIGN KEY (location_id) 
        REFERENCES public.locations(id) 
        ON DELETE SET NULL
        DEFERRABLE INITIALLY DEFERRED;

    ALTER TABLE public.users
      DROP CONSTRAINT IF EXISTS users_location_id_foreign,
      ADD CONSTRAINT users_location_id_foreign 
        FOREIGN KEY (location_id) 
        REFERENCES public.locations(id)
        ON DELETE SET NULL 
        DEFERRABLE INITIALLY DEFERRED;

    ALTER TABLE public.groups
      DROP CONSTRAINT IF EXISTS groups_location_id_foreign,
      ADD CONSTRAINT groups_location_id_foreign 
        FOREIGN KEY (location_id) 
        REFERENCES public.locations(id)
        ON DELETE SET NULL 
        DEFERRABLE INITIALLY DEFERRED;
  `)
}

exports.down = function(knex) {
  return knex.raw(`
    ALTER TABLE public.posts
      DROP CONSTRAINT posts_location_id_foreign,
      ADD CONSTRAINT posts_location_id_foreign 
        FOREIGN KEY (location_id) 
        REFERENCES public.locations(id);

    ALTER TABLE public.users
      DROP CONSTRAINT IF EXISTS users_location_id_foreign,
      ADD CONSTRAINT users_location_id_foreign 
        FOREIGN KEY (location_id) 
        REFERENCES public.locations(id);

    ALTER TABLE public.groups
      DROP CONSTRAINT IF EXISTS groups_location_id_foreign,
      ADD CONSTRAINT groups_location_id_foreign 
        FOREIGN KEY (location_id) 
        REFERENCES public.locations(id);
  `)
}