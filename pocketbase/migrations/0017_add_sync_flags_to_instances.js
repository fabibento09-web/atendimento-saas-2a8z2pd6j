migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('whatsapp_instances')

    if (!col.fields.getByName('needs_resync')) {
      col.fields.add(new BoolField({ name: 'needs_resync' }))
    }

    if (!col.fields.getByName('needs_initial_sync')) {
      col.fields.add(new BoolField({ name: 'needs_initial_sync' }))
    }

    app.save(col)
  },
  (app) => {
    const col = app.findCollectionByNameOrId('whatsapp_instances')

    if (col.fields.getByName('needs_resync')) {
      col.fields.removeByName('needs_resync')
    }

    if (col.fields.getByName('needs_initial_sync')) {
      col.fields.removeByName('needs_initial_sync')
    }

    app.save(col)
  },
)
