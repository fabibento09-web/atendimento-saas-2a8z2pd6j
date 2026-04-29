migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('whatsapp_messages')
    col.fields.add(new TextField({ name: 'link_title' }))
    col.fields.add(new TextField({ name: 'link_description' }))
    col.fields.add(new TextField({ name: 'link_url' }))
    col.fields.add(new TextField({ name: 'link_thumbnail_b64' }))
    app.save(col)
  },
  (app) => {
    const col = app.findCollectionByNameOrId('whatsapp_messages')
    col.fields.removeByName('link_title')
    col.fields.removeByName('link_description')
    col.fields.removeByName('link_url')
    col.fields.removeByName('link_thumbnail_b64')
    app.save(col)
  },
)
