migrate(
  (app) => {
    const collection = new Collection({
      name: 'whatsapp_messages',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: null,
      updateRule: null,
      deleteRule: null,
      fields: [
        { name: 'instance_name', type: 'text', required: true },
        { name: 'remote_jid', type: 'text' },
        { name: 'from_me', type: 'bool' },
        { name: 'message_id', type: 'text' },
        { name: 'push_name', type: 'text' },
        { name: 'content', type: 'text' },
        { name: 'message_type', type: 'text' },
        { name: 'timestamp', type: 'number' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_whatsapp_messages_instance_jid ON whatsapp_messages (instance_name, remote_jid)',
      ],
    })
    app.save(collection)
  },
  (app) => {
    const collection = app.findCollectionByNameOrId('whatsapp_messages')
    app.delete(collection)
  },
)
