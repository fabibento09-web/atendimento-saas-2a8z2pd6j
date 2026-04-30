migrate(
  (app) => {
    const collection = new Collection({
      name: 'crm_contacts',
      type: 'base',
      listRule: "@request.auth.id != '' && user_id = @request.auth.id",
      viewRule: "@request.auth.id != '' && user_id = @request.auth.id",
      createRule: "@request.auth.id != '' && @request.body.user_id = @request.auth.id",
      updateRule: "@request.auth.id != '' && user_id = @request.auth.id",
      deleteRule: "@request.auth.id != '' && user_id = @request.auth.id",
      fields: [
        {
          name: 'user_id',
          type: 'relation',
          required: true,
          collectionId: '_pb_users_auth_',
          cascadeDelete: true,
          maxSelect: 1,
        },
        { name: 'instance_name', type: 'text', required: true },
        { name: 'jid', type: 'text', required: true },
        { name: 'phone', type: 'text' },
        { name: 'push_name', type: 'text' },
        {
          name: 'avatar_file',
          type: 'file',
          maxSelect: 1,
          maxSize: 5242880,
          mimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
        },
        { name: 'avatar_url', type: 'text' },
        { name: 'status_text', type: 'text' },
        { name: 'is_business', type: 'bool' },
        { name: 'business_category', type: 'text' },
        { name: 'business_description', type: 'text' },
        { name: 'business_email', type: 'text' },
        { name: 'business_website', type: 'text' },
        { name: 'business_address', type: 'text' },
        { name: 'business_hours', type: 'json' },
        {
          name: 'stage',
          type: 'select',
          values: ['lead', 'em_atendimento', 'cliente', 'perdido'],
          maxSelect: 1,
        },
        { name: 'notes', type: 'editor' },
        { name: 'last_synced_at', type: 'date' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE UNIQUE INDEX idx_crm_contacts_user_instance_jid ON crm_contacts (user_id, instance_name, jid)',
        'CREATE INDEX idx_crm_contacts_stage ON crm_contacts (stage)',
      ],
    })
    app.save(collection)
  },
  (app) => {
    const collection = app.findCollectionByNameOrId('crm_contacts')
    app.delete(collection)
  },
)
