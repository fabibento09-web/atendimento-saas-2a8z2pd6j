migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('whatsapp_instances')
    if (!col.fields.getByName('auth_failure_count')) {
      col.fields.add(
        new NumberField({
          name: 'auth_failure_count',
          required: false,
        }),
      )
    }
    app.save(col)
  },
  (app) => {
    const col = app.findCollectionByNameOrId('whatsapp_instances')
    if (col.fields.getByName('auth_failure_count')) {
      col.fields.removeByName('auth_failure_count')
    }
    app.save(col)
  },
)
