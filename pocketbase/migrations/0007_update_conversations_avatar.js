migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('conversations')

    if (!col.fields.getByName('type')) {
      col.fields.add(
        new SelectField({ name: 'type', maxSelect: 1, values: ['individual', 'group'] }),
      )
    }
    if (!col.fields.getByName('avatar')) {
      col.fields.add(
        new FileField({
          name: 'avatar',
          maxSelect: 1,
          maxSize: 5242880,
          mimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
        }),
      )
    }
    if (!col.fields.getByName('picture_fetched_at')) {
      col.fields.add(new DateField({ name: 'picture_fetched_at' }))
    }

    app.save(col)

    // Seed existing data with proper type
    app
      .db()
      .newQuery(
        "UPDATE conversations SET type = 'group' WHERE is_group = 1 OR remote_jid LIKE '%@g.us'",
      )
      .execute()
    app
      .db()
      .newQuery("UPDATE conversations SET type = 'individual' WHERE type = '' OR type IS NULL")
      .execute()
  },
  (app) => {
    const col = app.findCollectionByNameOrId('conversations')
    col.fields.removeByName('type')
    col.fields.removeByName('avatar')
    col.fields.removeByName('picture_fetched_at')
    app.save(col)
  },
)
