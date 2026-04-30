migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('whatsapp_messages')
    if (!col.fields.getByName('participant_jid')) {
      col.fields.add(new TextField({ name: 'participant_jid' }))
    }
    if (!col.fields.getByName('participant_pushname')) {
      col.fields.add(new TextField({ name: 'participant_pushname' }))
    }
    app.save(col)
  },
  (app) => {
    const col = app.findCollectionByNameOrId('whatsapp_messages')
    col.fields.removeByName('participant_jid')
    col.fields.removeByName('participant_pushname')
    app.save(col)
  },
)
