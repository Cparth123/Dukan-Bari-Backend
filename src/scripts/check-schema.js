const { executeDataConnect } = require('../config/dataconnect');

async function checkArgs() {
  const q = `
    query {
      __type(name: "Mutation") {
        fields {
          name
          args {
            name
            type { name kind ofType { name kind } }
          }
        }
      }
    }
  `;
  const res = await executeDataConnect(q);
  const fields = res.data.__type.fields.filter(f => ['user_insert', 'user_update', 'store_insert', 'store_update', 'product_insert', 'product_update', 'product_delete'].includes(f.name));
  console.log(JSON.stringify(fields, null, 2));
}

checkArgs().catch(console.error);

