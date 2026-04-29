migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('whatsapp_messages')

    if (!col.fields.getByName('media_url')) {
      col.fields.add(new TextField({ name: 'media_url' }))
    }
    if (!col.fields.getByName('media_mimetype')) {
      col.fields.add(new TextField({ name: 'media_mimetype' }))
    }
    if (!col.fields.getByName('media_filename')) {
      col.fields.add(new TextField({ name: 'media_filename' }))
    }
    if (!col.fields.getByName('caption')) {
      col.fields.add(new TextField({ name: 'caption' }))
    }
    if (!col.fields.getByName('media_file')) {
      col.fields.add(new FileField({ name: 'media_file', maxSelect: 1, maxSize: 104857600 })) // 100MB max
    }

    app.save(col)
  },
  (app) => {
    const col = app.findCollectionByNameOrId('whatsapp_messages')
    col.fields.removeByName('media_url')
    col.fields.removeByName('media_mimetype')
    col.fields.removeByName('media_filename')
    col.fields.removeByName('caption')
    col.fields.removeByName('media_file')
    app.save(col)
  },
)
