migrate(
  (app) => {
    const collection = new Collection({
      name: 'whatsapp_instances',
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
          maxSelect: 1,
          cascadeDelete: true,
        },
        {
          name: 'instance_name',
          type: 'text',
          required: true,
        },
        {
          name: 'instance_id',
          type: 'text',
          required: true,
        },
        {
          name: 'instance_hash',
          type: 'text',
          required: true,
        },
        {
          name: 'status',
          type: 'select',
          values: ['creating', 'qrcode', 'connected', 'disconnected'],
          maxSelect: 1,
          required: false,
        },
        {
          name: 'phone_number',
          type: 'text',
          required: false,
        },
        {
          name: 'created',
          type: 'autodate',
          onCreate: true,
          onUpdate: false,
        },
        {
          name: 'updated',
          type: 'autodate',
          onCreate: true,
          onUpdate: true,
        },
      ],
      indexes: [],
    })

    app.save(collection)
  },
  (app) => {
    const collection = app.findCollectionByNameOrId('whatsapp_instances')
    app.delete(collection)
  },
)
