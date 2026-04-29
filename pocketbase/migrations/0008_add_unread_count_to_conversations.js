migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('conversations')
    col.fields.add(new NumberField({ name: 'unread_count' }))
    app.save(col)
  },
  (app) => {
    const col = app.findCollectionByNameOrId('conversations')
    col.fields.removeByName('unread_count')
    app.save(col)
  },
)
