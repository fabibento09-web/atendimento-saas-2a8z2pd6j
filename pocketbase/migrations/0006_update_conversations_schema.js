migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('conversations')

    if (!col.fields.getByName('remote_jid')) {
      col.fields.add(new TextField({ name: 'remote_jid' }))
    }
    if (!col.fields.getByName('is_group')) {
      col.fields.add(new BoolField({ name: 'is_group' }))
    }
    if (!col.fields.getByName('avatar_url')) {
      col.fields.add(new TextField({ name: 'avatar_url' }))
    }
    if (!col.fields.getByName('instance_name')) {
      col.fields.add(new TextField({ name: 'instance_name' }))
    }

    app.save(col)
  },
  (app) => {
    const col = app.findCollectionByNameOrId('conversations')
    col.fields.removeByName('remote_jid')
    col.fields.removeByName('is_group')
    col.fields.removeByName('avatar_url')
    col.fields.removeByName('instance_name')
    app.save(col)
  },
)
