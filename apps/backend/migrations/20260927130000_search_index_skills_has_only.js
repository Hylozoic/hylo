// Superseded by 20261029120000_search_index_groups_and_has_skills, which builds search_index with
// this change and the group rows from 20261002000000. Running this one after that (it's dated
// earlier) would have rebuilt the view without groups. Kept as a no-op so databases that
// already ran it still find it.
exports.up = async function () {}

exports.down = async function () {}
