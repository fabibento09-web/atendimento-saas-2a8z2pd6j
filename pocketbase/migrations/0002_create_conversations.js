migrate(
  (app) => {
    const categoriesCol = app.findCollectionByNameOrId('categories')
    const collection = new Collection({
      name: 'conversations',
      type: 'base',
      listRule: "@request.auth.id != '' && user_id = @request.auth.id",
      viewRule: "@request.auth.id != '' && user_id = @request.auth.id",
      createRule: "@request.auth.id != ''",
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
        { name: 'contact_name', type: 'text', required: false },
        { name: 'contact_phone', type: 'text', required: false },
        { name: 'last_message', type: 'text', required: false },
        { name: 'tags', type: 'relation', collectionId: categoriesCol.id, maxSelect: 100 },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
    })
    app.save(collection)
  },
  (app) => {
    const collection = app.findCollectionByNameOrId('conversations')
    app.delete(collection)
  },
)
