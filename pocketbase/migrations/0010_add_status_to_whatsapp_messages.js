migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('whatsapp_messages')
    if (!col.fields.getByName('status')) {
      col.fields.add(new TextField({ name: 'status' }))
    }
    app.save(col)
  },
  (app) => {
    const col = app.findCollectionByNameOrId('whatsapp_messages')
    if (col.fields.getByName('status')) {
      col.fields.removeByName('status')
      app.save(col)
    }
  },
)
