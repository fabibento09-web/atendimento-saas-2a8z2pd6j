migrate(
  (app) => {
    const collection = app.findCollectionByNameOrId('whatsapp_messages')
    let hasChanges = false

    if (!collection.fields.getByName('media_type')) {
      collection.fields.add(new TextField({ name: 'media_type', required: false }))
      hasChanges = true
    }

    if (!collection.fields.getByName('media_url')) {
      collection.fields.add(new TextField({ name: 'media_url', required: false }))
      hasChanges = true
    }

    if (!collection.fields.getByName('media_mimetype')) {
      collection.fields.add(new TextField({ name: 'media_mimetype', required: false }))
      hasChanges = true
    }

    if (!collection.fields.getByName('media_filename')) {
      collection.fields.add(new TextField({ name: 'media_filename', required: false }))
      hasChanges = true
    }

    if (!collection.fields.getByName('caption')) {
      collection.fields.add(new TextField({ name: 'caption', required: false }))
      hasChanges = true
    }

    if (hasChanges) {
      app.save(collection)
    }
  },
  (app) => {
    const collection = app.findCollectionByNameOrId('whatsapp_messages')
    let hasChanges = false

    if (collection.fields.getByName('media_type')) {
      collection.fields.removeByName('media_type')
      hasChanges = true
    }

    if (hasChanges) {
      app.save(collection)
    }
  },
)
