module.exports = bookshelf.Model.extend(Object.assign({
  tableName: 'group_join_questions_answers',
  requireFetch: false,
  hasTimestamps: true,

  group () {
    return this.belongsTo(Group)
  },

  joinRequest () {
    return this.belongsTo(JoinRequest)
  },

  question () {
    return this.belongsTo(Question)
  },

  user () {
    return this.belongsTo(User)
  }

}), {

  latestAnswersFor: async function (groupId, userId) {
    const latestAnswers = await bookshelf.knex.raw(`
      SELECT *
      FROM (
        SELECT
          qa.answer as answer,
          q.text as text,
          ROW_NUMBER() OVER (PARTITION BY qa.question_id ORDER BY qa.created_at DESC) as rn
        FROM
          group_join_questions_answers qa
          JOIN questions q ON q.id = qa.question_id
        WHERE
          qa.group_id = ? AND qa.user_id = ?
      ) ranked
      WHERE
        ranked.rn = 1;
    `, [groupId, userId])

    const joinQuestionAnswers = latestAnswers.rows.map(row => ({
      text: row.text,
      answer: row.answer
    }))

    return joinQuestionAnswers
  }
})
